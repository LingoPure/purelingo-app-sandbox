/**
 * POST /api/admin/content-editors/invite — invite a content editor.
 *
 * Admin-only (requireContentAdmin). Mirrors the employer staff-invite transport:
 * find-or-create the auth user, provision a public.content_editors row with the
 * chosen role, generate a direct /auth/callback magic link, and email it via
 * Resend (best-effort — the link is always returned for manual delivery).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireContentAdmin } from "@/lib/content/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContentEditorInviteEmail } from "@/lib/email/invite";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  role: z.enum(["admin", "marketing", "readonly"]).default("marketing"),
});

export async function POST(request: NextRequest) {
  const admin = await requireContentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const email = body.email.toLowerCase();

  const origin =
    request.headers.get("origin") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const redirectTo = `${origin}/auth/callback?next=/admin`;
  const directCallback = (tokenHash: string, linkType: "invite" | "magiclink") =>
    `${origin}/auth/callback?token_hash=${encodeURIComponent(
      tokenHash
    )}&type=${linkType}&next=${encodeURIComponent("/admin")}`;

  // 1. Look up the user (paged — fine at this scale).
  let userId: string | null = null;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const u of data.users) {
      if (u.email?.toLowerCase() === email) {
        userId = u.id;
        break;
      }
    }
    if (userId || data.users.length < 200) break;
    page += 1;
  }

  // 2. Issue the right link kind.
  let actionLink: string | null = null;
  let kind: "invite" | "magiclink" = "invite";
  let mailWarning: string | null = null;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: body.name },
    });
    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Invite failed" },
        { status: 500 }
      );
    }
    userId = data.user.id;
    const linkRes = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { full_name: body.name } },
    });
    if (linkRes.error || !linkRes.data.properties?.hashed_token) {
      mailWarning = `Editor created but couldn't generate copy-link: ${
        linkRes.error?.message ?? "missing hashed_token"
      }`;
    } else {
      actionLink = directCallback(linkRes.data.properties.hashed_token, "invite");
    }
  } else {
    const linkRes = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkRes.error || !linkRes.data.properties?.hashed_token) {
      return NextResponse.json(
        {
          error: `Magic link generation failed: ${
            linkRes.error?.message ?? "missing hashed_token"
          }`,
        },
        { status: 500 }
      );
    }
    actionLink = directCallback(linkRes.data.properties.hashed_token, "magiclink");
    kind = "magiclink";
    mailWarning =
      "Existing-user magic links are not auto-emailed by Supabase — paste the link below to the invitee.";
  }

  // 3. Provision / update the content_editors row (service role bypasses RLS).
  const { error: upsertErr } = await supabase
    .from("content_editors")
    .upsert(
      {
        user_id: userId,
        email,
        role: body.role,
        invited_by: admin.userId,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // 4. Email the link via Resend (best-effort; link also returned).
  let emailDelivery: "sent" | "skipped" | "failed" = "skipped";
  if (actionLink) {
    const send = await sendContentEditorInviteEmail({
      to: email,
      inviteeName: body.name,
      role: body.role,
      actionLink,
    });
    if (send.ok) emailDelivery = "sent";
    else if (send.error === "RESEND_API_KEY not configured") {
      mailWarning =
        mailWarning ??
        "RESEND_API_KEY not set on this deployment — paste the link below to the invitee.";
    } else {
      emailDelivery = "failed";
      mailWarning = mailWarning ?? `Email send failed (${send.error}) — paste the link manually.`;
    }
  }

  return NextResponse.json({
    ok: true,
    userId,
    role: body.role,
    kind,
    actionLink,
    emailDelivery,
    mailWarning,
    message:
      emailDelivery === "sent"
        ? `Invite emailed to ${email}.`
        : `Editor invited (${email}). Link shown below for manual delivery.`,
  });
}
