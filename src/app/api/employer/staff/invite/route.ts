/**
 * POST /api/employer/staff/invite — magic-link invite for one staff member.
 *
 * Two paths, both end with an email going out:
 *   1. Email NOT in auth.users → auth.admin.inviteUserByEmail()
 *      Creates the user + sends an "invite" email pointing at
 *      /auth/callback?next=/onboarding.
 *   2. Email IS in auth.users → auth.admin.generateLink({type:"magiclink"})
 *      User already exists (e.g. seeded persona, prior invite). Sends a
 *      sign-in magic link to the same URL.
 *
 * Either way: pre-stamp the students row with employer_id + role_id +
 * name + target_level so the role baseline is locked in BEFORE they
 * click the link.
 *
 * The response always includes `actionLink` — the actual URL — so the
 * admin can copy-paste it manually if Supabase email delivery is rate-
 * limited / unconfigured / spam-filtered. No silent failures.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";

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

  // Magic-link / invite emails point at /auth/callback. The callback
  // routes admins to /employer and everyone else to ?next= (we set
  // /onboarding here so candidates land directly in their discovery flow).
  const origin =
    request.headers.get("origin") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const redirectTo = `${origin}/auth/callback?next=/onboarding`;

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

  // 2. Issue the right kind of link based on existence. Both paths
  //    auto-email via Supabase; we also return the URL so the admin
  //    can copy it manually if email delivery is rate-limited.
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
    kind = "invite";

    // Generate the actual link too so we can show / copy it. (Invite
    // already sends an email, but the admin may need the URL anyway.)
    const linkRes = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { full_name: body.name } },
    });
    if (linkRes.error) {
      mailWarning = `Invite created but couldn't generate display link: ${linkRes.error.message}`;
    } else {
      actionLink = linkRes.data.properties?.action_link ?? null;
    }
  } else {
    // Existing user — send a magic-link sign-in email instead of an invite.
    const linkRes = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkRes.error) {
      return NextResponse.json(
        { error: `Magic link generation failed: ${linkRes.error.message}` },
        { status: 500 }
      );
    }
    actionLink = linkRes.data.properties?.action_link ?? null;
    kind = "magiclink";
  }

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

  const messageBase =
    kind === "invite"
      ? `Invite created for ${email}.`
      : `Magic-link sign-in created for ${email} (already onboarded).`;
  const messageTail = actionLink
    ? " The link is shown below — Supabase will also email it, but free-tier rate limits + spam filters mean you may need to send it manually."
    : "";

  return NextResponse.json({
    ok: true,
    userId,
    kind,
    actionLink,
    mailWarning,
    message: messageBase + messageTail,
  });
}
