/**
 * POST /api/employer/roles/discovery/session — start (or resume) a voice
 * role-discovery interview for the calling employer admin.
 *
 * Body: { roleName: string }. If a role with that name already exists for
 * this employer, the interview resumes against it (re-running the interview
 * refines rather than duplicates); otherwise a draft role row is created
 * first (defined_via: 'voice_interview', no baselines yet), so the voice
 * session's "subject" is the role being defined rather than the admin —
 * primeContext looks it up by this id. The admin's own identity is bound
 * separately via the existing generic /api/convai/bind, same as every
 * other voice agent in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { roleDiscovery } from "@/lib/roles/role-discovery";

const BodySchema = z.object({
  roleName: z.string().trim().min(2).max(120),
});

export async function POST(request: NextRequest) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const { employerId } = auth.admin;
  const adminUserId = auth.admin.authUserId;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = adminSupabase();

  // Resume against an existing role of this name, or create a draft.
  const { data: existing } = await supabase
    .from("roles")
    .select("id")
    .eq("employer_id", employerId)
    .eq("name", body.roleName)
    .maybeSingle();

  let roleId: string;
  if (existing) {
    roleId = (existing as { id: string }).id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("roles")
      .insert({
        employer_id: employerId,
        name: body.roleName,
        defined_via: "voice_interview",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message ?? "Failed to create draft role" },
        { status: 500 }
      );
    }
    roleId = (created as { id: string }).id;
  }

  const { error: sessionErr } = await supabase
    .from("role_discovery_sessions")
    .insert({
      role_id: roleId,
      employer_id: employerId,
      admin_user_id: adminUserId,
      status: "pending",
    });
  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  try {
    const session = await roleDiscovery.startSession(roleId);
    return NextResponse.json({ ...session, roleId });
  } catch (err) {
    console.error("role-discovery session start failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start session" },
      { status: 500 }
    );
  }
}
