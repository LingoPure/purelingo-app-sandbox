/**
 * POST /api/admin/role-templates/:id/reject
 *
 * Platform-admin rejection of a pending role template: template_status
 * pending_review -> private, stamped with who/when. Deliberately does NOT
 * clear sanitized_description — the employer can revise it and resubmit via
 * POST /api/employer/roles/:id/publish rather than starting over.
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id: roleId } = await params;

  const supabase = createAdminClient();

  const { data: role, error: fetchErr } = await supabase
    .from("roles")
    .select("id, template_status")
    .eq("id", roleId)
    .maybeSingle<{ id: string; template_status: string }>();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.template_status !== "pending_review") {
    return NextResponse.json(
      { error: "This role isn't awaiting review." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("roles")
    .update({
      template_status: "private",
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", roleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
