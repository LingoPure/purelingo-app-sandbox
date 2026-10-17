/**
 * POST /api/employer/roles/adopt — clone a PUBLISHED cross-employer role
 * template into the calling employer's own roster.
 *
 * Per the platform template-sharing design (migration 0066): a role is
 * never read directly across employers at runtime. Adopting a template
 * creates a NEW roles row scoped to this employer (own id, own baselines),
 * copying the source's sanitized_description (never its raw description)
 * and profile_json verbatim (role-generic content — responsibilities,
 * vocabulary domain, skill rationale/examples — carries no employer
 * identity). template_source_role_id is provenance only; the clone is
 * fully independent from here on, editable without touching the original.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

const BodySchema = z.object({
  templateRoleId: z.string().uuid(),
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

  const { data: source, error: sourceErr } = await supabase
    .from("roles")
    .select("id, name, sanitized_description, profile_json, defined_via, template_status")
    .eq("id", body.templateRoleId)
    .eq("template_status", "published")
    .maybeSingle<{
      id: string;
      name: string;
      sanitized_description: string | null;
      profile_json: unknown;
      defined_via: string;
      template_status: string;
    }>();
  if (sourceErr) return NextResponse.json({ error: sourceErr.message }, { status: 500 });
  if (!source) {
    return NextResponse.json(
      { error: "That template is no longer available." },
      { status: 404 }
    );
  }

  const { data: sourceBaselines, error: baselineErr } = await supabase
    .from("role_baselines")
    .select("skill, min_score")
    .eq("role_id", source.id)
    .returns<{ skill: string; min_score: number }[]>();
  if (baselineErr) return NextResponse.json({ error: baselineErr.message }, { status: 500 });

  const { data: newRole, error: insertErr } = await supabase
    .from("roles")
    .insert({
      employer_id: employerId,
      name: source.name,
      description: source.sanitized_description,
      profile_json: source.profile_json,
      defined_via: source.defined_via,
      template_source_role_id: source.id,
    })
    .select("id, name")
    .single<{ id: string; name: string }>();
  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        {
          error: `You already have a role named "${source.name}" — rename or archive it first, then adopt again.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  const rows = (sourceBaselines ?? [])
    .filter((b): b is { skill: SkillKey; min_score: number } =>
      (SKILL_KEYS as readonly string[]).includes(b.skill)
    )
    .map((b) => ({ role_id: newRole.id, skill: b.skill, min_score: b.min_score }));
  if (rows.length > 0) {
    const { error } = await supabase.from("role_baselines").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, role: { id: newRole.id, name: newRole.name } });
}
