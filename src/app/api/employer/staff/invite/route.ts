/**
 * POST /api/employer/staff/invite — magic-link invite for one staff member.
 *
 * Two paths:
 *   1. Email NOT in auth.users → auth.admin.inviteUserByEmail()
 *      Creates the user + asks Supabase to email an invite. Supabase's
 *      built-in mailer is rate-limited (~3-4/hr on free tier) and often
 *      spam-filtered, so we treat it as best-effort.
 *   2. Email IS in auth.users → auth.admin.generateLink({type:"magiclink"})
 *      generateLink does NOT send an email — it only returns the link.
 *      We rely on the admin copy-pasting the returned URL.
 *
 * Either way we ALWAYS return an `actionLink` the admin can paste into
 * a chat / email manually. That link is built directly against our own
 * /auth/callback with `?token_hash=…&type=…&next=/onboarding` — NOT the
 * Supabase verify URL that generateLink hands back. That matters: the
 * Supabase verify endpoint redirects to redirect_to with auth tokens in
 * the URL hash fragment for type=magiclink (implicit flow), which the
 * server-side route handler can never read, so it falls through to
 * /login. Pointing straight at our callback with token_hash as a query
 * param consumes the OTP via supabase.auth.verifyOtp() server-side and
 * sets the session cookie cleanly.
 *
 * Pre-stamps the students row with employer_id + role_id + name +
 * target_level so the role baseline is locked in before they click.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { sendInviteEmail } from "@/lib/email/invite";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  roleId: z.string().uuid(),
  targetLevel: z.enum(["A2", "B1", "B2", "C1", "C2"]).default("B2"),
});

export async function POST(request: NextRequest) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const employerId = auth.admin.employerId;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = adminSupabase();
  const email = body.email.toLowerCase();

  // Two URLs we care about:
  //  - redirectTo: passed to Supabase as the post-verify destination.
  //    Used by inviteUserByEmail's emailed link.
  //  - directCallback(): builds an action link that points STRAIGHT at
  //    our callback with ?token_hash=…&type=…&next=/onboarding so we
  //    consume the OTP server-side. Bypasses Supabase's verify endpoint
  //    entirely, which is what we paste into the admin UI for the
  //    "copy & message it manually" path.
  const origin =
    request.headers.get("origin") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const redirectTo = `${origin}/auth/callback?next=/onboarding`;
  const directCallback = (
    tokenHash: string,
    linkType: "invite" | "magiclink"
  ) =>
    `${origin}/auth/callback?token_hash=${encodeURIComponent(
      tokenHash
    )}&type=${linkType}&next=${encodeURIComponent("/onboarding")}`;

  // 1. Look up the user (paged listUsers — fine at 1k staff, not 1M).
  let userId: string | null = null;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const u of data.users) {
      if (u.email?.toLowerCase() === email) {
        userId = u.id;
        break;
      }
    }
    if (userId || data.users.length < 200) break;
    page += 1;
  }

  // 2. Issue the right kind of link based on existence. Only the
  //    inviteUserByEmail path auto-mails (best effort); generateLink
  //    is link-only. Either way we return the URL for manual delivery.
  let actionLink: string | null = null;
  let kind: "invite" | "magiclink" = "invite";
  let mailWarning: string | null = null;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: body.name },
    });
    if (error || !data.user) {
      console.error("[invite] inviteUserByEmail failed", {
        email,
        message: error?.message,
      });
      return NextResponse.json(
        { error: error?.message ?? "Invite failed" },
        { status: 500 }
      );
    }
    userId = data.user.id;
    kind = "invite";

    // Re-generate the link to grab hashed_token. inviteUserByEmail
    // already triggered Supabase's mailer (best-effort); this call is
    // for the URL we surface to the admin to paste manually.
    const linkRes = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { full_name: body.name } },
    });
    if (linkRes.error || !linkRes.data.properties?.hashed_token) {
      mailWarning = `Invite created but couldn't generate copy-link: ${
        linkRes.error?.message ?? "missing hashed_token"
      }`;
    } else {
      actionLink = directCallback(
        linkRes.data.properties.hashed_token,
        "invite"
      );
    }
  } else {
    // Existing user — generateLink is link-only (no email). The admin
    // must paste the actionLink manually.
    const linkRes = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkRes.error || !linkRes.data.properties?.hashed_token) {
      console.error("[invite] generateLink magiclink failed", {
        email,
        message: linkRes.error?.message,
      });
      return NextResponse.json(
        {
          error: `Magic link generation failed: ${
            linkRes.error?.message ?? "missing hashed_token"
          }`,
        },
        { status: 500 }
      );
    }
    actionLink = directCallback(
      linkRes.data.properties.hashed_token,
      "magiclink"
    );
    kind = "magiclink";
    mailWarning =
      "Existing-user magic links are not auto-emailed by Supabase — paste the link below to the invitee.";
  }

  console.log("[invite] issued", { email, kind, hasLink: Boolean(actionLink) });

  // 3. Pre-stamp the students row with employer + role + name + target.
  //    handle_new_user creates the row on invite acceptance; if the user
  //    already existed the row's already there. role_id is the buyer's
  //    bar from this point forward.
  const { error: studentErr } = await supabase
    .from("students")
    .update({
      name: body.name,
      email,
      employer_id: employerId,
      role_id: body.roleId,
      target_level: body.targetLevel,
    })
    .eq("id", userId);
  if (studentErr) {
    return NextResponse.json({ error: studentErr.message }, { status: 500 });
  }

  // 4. Email the action link via Resend. We do NOT depend on Supabase
  //    Auth's mailer for this — for the magiclink path it never emails
  //    at all, and even for the invite path the verify-URL flow lands
  //    on /login. Resend with our own template + direct callback URL is
  //    the reliable channel.
  let emailDelivery: "sent" | "skipped" | "failed" = "skipped";
  let emailError: string | null = null;
  if (actionLink) {
    const { data: empRow } = await supabase
      .from("employers")
      .select("name")
      .eq("id", employerId)
      .maybeSingle();
    const employerName =
      (empRow as { name?: string } | null)?.name ?? null;
    const send = await sendInviteEmail({
      to: email,
      inviteeName: body.name,
      employerName,
      actionLink,
      kind,
    });
    if (send.ok) {
      emailDelivery = "sent";
    } else if (send.error === "RESEND_API_KEY not configured") {
      emailDelivery = "skipped";
      emailError = send.error;
      mailWarning =
        mailWarning ??
        "RESEND_API_KEY not set on this deployment — paste the link below to the invitee manually.";
    } else {
      emailDelivery = "failed";
      emailError = send.error ?? "Resend send failed";
      console.error("[invite] resend send failed", {
        email,
        kind,
        error: send.error,
      });
      mailWarning =
        mailWarning ??
        `Email send failed (${send.error}) — paste the link below manually.`;
    }
  }

  console.log("[invite] complete", { email, kind, emailDelivery });

  const messageBase =
    emailDelivery === "sent"
      ? `Invite emailed to ${email} via Resend.`
      : kind === "invite"
        ? `Invite created for ${email}.`
        : `Magic-link sign-in link created for ${email} (already onboarded).`;
  const messageTail = actionLink
    ? " The link is also shown below for manual delivery if needed."
    : "";

  return NextResponse.json({
    ok: true,
    userId,
    kind,
    actionLink,
    mailWarning,
    emailDelivery,
    emailError,
    message: messageBase + messageTail,
  });
}
