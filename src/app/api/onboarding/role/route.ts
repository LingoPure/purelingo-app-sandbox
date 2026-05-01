/**
 * POST /api/onboarding/role — student confirms or changes their role.
 *
 * Called from the role-confirm step on /onboarding before the discovery
 * session starts. Authenticated via the Supabase student session — the
 * student can only update their own row.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  roleId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Verify the role belongs to the student's employer (defence in depth —
  // RLS on roles is read-public for authenticated users, but we don't
  // want a student picking a role from a different employer).
  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("employer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (studentErr) {
    return NextResponse.json({ error: studentErr.message }, { status: 500 });
  }
  const employerId = (studentRow as { employer_id?: string | null } | null)
    ?.employer_id;
  if (!employerId) {
    return NextResponse.json(
      { error: "No employer on file for this account." },
      { status: 400 }
    );
  }

  const { data: roleRow, error: roleErr } = await supabase
    .from("roles")
    .select("id, employer_id, is_archived")
    .eq("id", body.roleId)
    .maybeSingle();
  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }
  const role = roleRow as
    | { id: string; employer_id: string; is_archived: boolean }
    | null;
  if (!role || role.employer_id !== employerId || role.is_archived) {
    return NextResponse.json(
      { error: "Role not available for this account." },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabase
    .from("students")
    .update({ role_id: body.roleId })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
