/**
 * Platform-admin side of the role-template review queue (migration 0066).
 *
 * An employer submits a role via POST /api/employer/roles/:id/publish
 * (template_status -> pending_review). A platform admin reviews it here —
 * SANITIZED description only, plus the structured profile and baselines so
 * the reviewer can judge whether the definition is generic/reusable rather
 * than naming this employer's own clients or processes — and approves
 * (-> published, visible platform-wide to every employer's invite flow) or
 * rejects (-> private, the employer can revise and resubmit).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

export type RoleTemplateReviewRow = {
  id: string;
  name: string;
  sanitizedDescription: string | null;
  employerName: string;
  defineVia: string;
  baselines: Partial<Record<SkillKey, number>>;
};

export async function loadPendingRoleTemplates(
  supabase: SupabaseClient
): Promise<RoleTemplateReviewRow[]> {
  const { data: roles, error } = await supabase
    .from("roles")
    .select("id, name, sanitized_description, defined_via, employer_id")
    .eq("template_status", "pending_review")
    .order("name", { ascending: true })
    .returns<
      { id: string; name: string; sanitized_description: string | null; defined_via: string; employer_id: string }[]
    >();
  if (error) throw new Error(`pending role templates lookup failed: ${error.message}`);
  if (!roles || roles.length === 0) return [];

  const roleIds = roles.map((r) => r.id);
  const employerIds = [...new Set(roles.map((r) => r.employer_id))];

  const [employersRes, baselinesRes] = await Promise.all([
    supabase.from("employers").select("id, name").in("id", employerIds),
    supabase
      .from("role_baselines")
      .select("role_id, skill, min_score")
      .in("role_id", roleIds)
      .returns<{ role_id: string; skill: string; min_score: number }[]>(),
  ]);

  const employerNameById = new Map<string, string>(
    (employersRes.data ?? []).map((e) => [
      (e as { id: string; name: string }).id,
      (e as { id: string; name: string }).name,
    ])
  );

  const baselinesByRole = new Map<string, Partial<Record<SkillKey, number>>>();
  for (const b of baselinesRes.data ?? []) {
    if (!(SKILL_KEYS as readonly string[]).includes(b.skill)) continue;
    let bucket = baselinesByRole.get(b.role_id);
    if (!bucket) {
      bucket = {};
      baselinesByRole.set(b.role_id, bucket);
    }
    bucket[b.skill as SkillKey] = b.min_score;
  }

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    sanitizedDescription: r.sanitized_description,
    employerName: employerNameById.get(r.employer_id) ?? "Unknown employer",
    defineVia: r.defined_via,
    baselines: baselinesByRole.get(r.id) ?? {},
  }));
}
