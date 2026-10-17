/**
 * POST /api/employer/roles/:id/publish   — submit a role as a cross-employer
 *                                           template (template_status -> pending_review).
 * DELETE /api/employer/roles/:id/publish — withdraw a PENDING submission
 *                                           (template_status -> private).
 *
 * Part of the platform template-sharing design (migration 0066): the
 * employer writes their own sanitized_description (the version other
 * employers will see — never the raw description, which may name this
 * employer's own clients/processes) and submits for platform-admin review.
 * A platform admin approves/rejects from /admin/role-templates.
 *
 * Withdraw only reverts a PENDING submission — an already-published
 * template may already be adopted by other employers, so un-publishing
 * that is a bigger decision than this route handles.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";

const BodySchema = z.object({
  sanitizedDescription: z.string().trim().min(10).max(700),
});

async function loadOwnRole(
  supabase: ReturnType<typeof adminSupabase>,
  roleId: string,
  employerId: string
) {
  return supabase
    .from("roles")
    .select("id, employer_id, template_status")
    .eq("id", roleId)
    .eq("employer_id", employerId)
    .maybeSingle<{ id: string; employer_id: string; template_status: string }>();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id: roleId } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = adminSupabase();
  // Scoped to THIS employer's own role — an admin can never publish a role
  // they don't own, even if they know its id.
  const { data: role, error: fetchErr } = await loadOwnRole(
    supabase,
    roleId,
    auth.admin.employerId
  );
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.template_status === "published") {
    return NextResponse.json({ error: "This role is already published." }, { status: 409 });
  }

  const { error } = await supabase
    .from("roles")
    .update({
      template_status: "pending_review",
      sanitized_description: body.sanitizedDescription,
    })
    .eq("id", roleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id: roleId } = await params;

  const supabase = adminSupabase();
  const { data: role, error: fetchErr } = await loadOwnRole(
    supabase,
    roleId,
    auth.admin.employerId
  );
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.template_status !== "pending_review") {
    return NextResponse.json(
      { error: "Only a pending submission can be withdrawn this way." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("roles")
    .update({ template_status: "private" })
    .eq("id", roleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
