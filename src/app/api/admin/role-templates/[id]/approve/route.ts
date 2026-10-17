/**
 * POST /api/admin/role-templates/:id/approve
 *
 * Platform-admin approval of a pending role template (migration 0066):
 * template_status pending_review -> published, stamped with who/when. Once
 * published the role (its sanitized_description, profile_json, baselines)
 * becomes selectable by every OTHER employer's staff-invite flow via the
 * adopt route — see loadPublishedTemplates / POST /api/employer/roles/adopt.
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
      template_status: "published",
      published_at: new Date().toISOString(),
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", roleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
