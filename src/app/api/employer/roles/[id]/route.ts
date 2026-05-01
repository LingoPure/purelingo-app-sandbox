/**
 * PATCH /api/employer/roles/:id  — update name/description/baselines/archive.
 * DELETE /api/employer/roles/:id — soft-delete (sets is_archived = true).
 *
 * We never hard-delete: archived roles preserve historical gap_scores rows
 * whose role context still matters. Students assigned to an archived role
 * stay assigned (see migration 0010 — on role delete it's a SET NULL).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { SKILL_KEYS } from "@/lib/scoring/rubric";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  baselines: z
    .record(z.string(), z.number().int().min(0).max(1000))
    .optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id: roleId } = await params;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = adminSupabase();

  const roleUpdate: Record<string, unknown> = {};
  if (body.name !== undefined) roleUpdate.name = body.name;
  if (body.description !== undefined) roleUpdate.description = body.description;
  if (body.isArchived !== undefined) roleUpdate.is_archived = body.isArchived;

  if (Object.keys(roleUpdate).length > 0) {
    const { error } = await supabase
      .from("roles")
      .update(roleUpdate)
      .eq("id", roleId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (body.baselines) {
    const rows = SKILL_KEYS.filter(
      (skill) => typeof body.baselines![skill] === "number"
    ).map((skill) => ({
      role_id: roleId,
      skill,
      min_score: body.baselines![skill],
    }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from("role_baselines")
        .upsert(rows, { onConflict: "role_id,skill" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
  }

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
  const { error } = await supabase
    .from("roles")
    .update({ is_archived: true })
    .eq("id", roleId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
