/**
 * PATCH  /api/employer/join-requests/:id — approve a pending join request.
 *   Body: { roleId: string } — must belong to the SAME employer as the
 *   requested organisation (the request's own availableRoles list).
 * DELETE /api/employer/join-requests/:id — decline. Deletes the pending
 *   membership row outright; there is no persistent "declined" state to
 *   keep, so the student can re-request later without a stale tombstone
 *   blocking them.
 *
 * ISS-049 follow-up: self-setup routes a company-name collision into a
 * pending organisation_memberships row instead of a silent duplicate org
 * (src/lib/org/self-setup.ts). This is where an admin resolves it.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";

const ApproveSchema = z.object({
  roleId: z.string().uuid(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id: membershipId } = await params;

  let body: z.infer<typeof ApproveSchema>;
  try {
    body = ApproveSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = adminSupabase();

  const { data: membership, error: membershipLookupError } = await supabase
    .from("organisation_memberships")
    .select("id, user_id, organisation_id, status")
    .eq("id", membershipId)
    .maybeSingle();
  if (membershipLookupError || !membership) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (membership.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 409 }
    );
  }

  // The role must belong to the SAME employer as the requested org — never
  // trust a client-supplied roleId blindly, or an admin's mistyped/forged
  // request could assign a student into an unrelated org's role.
  const { data: employer } = await supabase
    .from("employers")
    .select("id")
    .eq("organisation_id", membership.organisation_id)
    .maybeSingle();
  const { data: role } = employer
    ? await supabase
        .from("roles")
        .select("id, employer_id")
        .eq("id", body.roleId)
        .eq("employer_id", employer.id)
        .maybeSingle()
    : { data: null };
  if (!employer || !role) {
    return NextResponse.json(
      { error: "That role doesn't belong to this organisation." },
      { status: 400 }
    );
  }

  const { error: studentError } = await supabase
    .from("students")
    .update({ employer_id: employer.id, role_id: role.id })
    .eq("id", membership.user_id);
  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  const { error: approveError } = await supabase
    .from("organisation_memberships")
    .update({ status: "active", invite_accepted_at: new Date().toISOString() })
    .eq("id", membershipId);
  if (approveError) {
    return NextResponse.json({ error: approveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id: membershipId } = await params;

  const supabase = adminSupabase();
  const { error } = await supabase
    .from("organisation_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("status", "pending");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
