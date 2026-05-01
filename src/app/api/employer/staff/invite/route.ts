/**
 * POST /api/employer/staff/invite — magic-link invite for one staff member.
 *
 * Flow:
 *   1. Admin enters name + email + role on /employer/staff/invite
 *   2. We call auth.admin.inviteUserByEmail() — Supabase emails the user a
 *      magic link pointing at /auth/callback?next=/onboarding
 *   3. We pre-stamp the students row with employer_id + role_id + name +
 *      target_level so that when the candidate lands in /onboarding,
 *      their role baseline is already known and the discovery scorer can
 *      calibrate against the buyer's bar from turn one.
 *
 * Idempotent: if the email is already in auth.users we skip the invite
 * and just refresh the students row so the admin can re-assign someone
 * who's already been onboarded.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EMPLOYER_COOKIE_NAME, cookieIsValid } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { resolveActiveEmployerId } from "@/lib/employer/roles-data";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  roleId: z.string().uuid(),
  targetLevel: z.enum(["A2", "B1", "B2", "C1", "C2"]).default("B2"),
});

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(EMPLOYER_COOKIE_NAME)?.value;
  if (!(await cookieIsValid(cookie))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const employerId = await resolveActiveEmployerId();
  if (!employerId) {
    return NextResponse.json(
      { error: "No employer configured — seed first." },
      { status: 400 }
    );
  }

  const supabase = adminSupabase();
  const email = body.email.toLowerCase();

  // The magic link Supabase sends will land on /auth/callback. The callback
  // exchanges the code for a session and redirects to ?next= — we send
  // candidates straight into onboarding.
  const origin =
    request.headers.get("origin") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const redirectTo = `${origin}/auth/callback?next=/onboarding`;

  // 1. Check if the user already exists (idempotency).
  let userId: string | null = null;
  let invited = false;
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
    invited = true;
  }

  // 2. Stamp the students row (handle_new_user trigger creates it on
  //    invite acceptance; if we got an existing user, the row already
  //    exists). The role_id is the buyer's bar from this point forward.
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

  return NextResponse.json({
    ok: true,
    userId,
    invited,
    message: invited
      ? `Invite sent to ${email}.`
      : `${email} already onboarded — role assignment updated.`,
  });
}
