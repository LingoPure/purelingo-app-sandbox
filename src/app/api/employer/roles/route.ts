/**
 * POST /api/employer/roles — create a role + 6 baselines.
 * Gated by the employer cookie (same gate as /employer/*).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { SKILL_KEYS } from "@/lib/scoring/rubric";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  baselines: z.record(z.string(), z.number().int().min(0).max(1000)),
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

  for (const skill of SKILL_KEYS) {
    if (typeof body.baselines[skill] !== "number") {
      return NextResponse.json(
        { error: `Missing baseline for ${skill}` },
        { status: 400 }
      );
    }
  }

  const supabase = adminSupabase();

  const { data: roleRow, error: insertErr } = await supabase
    .from("roles")
    .insert({
      employer_id: employerId,
      name: body.name,
      description: body.description ?? null,
    })
    .select("id")
    .single();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }
  const roleId = (roleRow as { id: string }).id;

  const baselineRows = SKILL_KEYS.map((skill) => ({
    role_id: roleId,
    skill,
    min_score: body.baselines[skill],
  }));
  const { error: baselineErr } = await supabase
    .from("role_baselines")
    .upsert(baselineRows, { onConflict: "role_id,skill" });
  if (baselineErr) {
    return NextResponse.json({ error: baselineErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: roleId });
}
