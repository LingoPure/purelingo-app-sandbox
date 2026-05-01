/**
 * Per-skill baseline lookup for a student.
 *
 * Resolution order:
 *   1. The student's role's role_baselines rows (if assigned + populated)
 *   2. Flat 80 fallback for any skill the role hasn't defined yet
 *      (or when the student isn't assigned to a role at all)
 *
 * The 80 fallback is intentional — pre-role data, hand-loaded students,
 * and demo accounts all need a sensible default. Roles are an additive
 * layer; the system still works without them.
 *
 * Used by:
 *   - score-discovery.ts (writes gap_scores.target at scoring time)
 *   - /api/scoring/discovery/route.ts (manual re-score)
 *   - lesson generators (calibrate scenario difficulty against baseline)
 *   - employer rollup queries (compute "meets baseline" per row)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILL_KEYS, type SkillKey } from "./rubric";

export const FLAT_FALLBACK_TARGET = 80;

export type Baselines = Record<SkillKey, number>;

function flatBaselines(): Baselines {
  return Object.fromEntries(
    SKILL_KEYS.map((k) => [k, FLAT_FALLBACK_TARGET])
  ) as Baselines;
}

/**
 * Load the per-skill baseline for one student. Returns flat 80s if the
 * student has no role assigned. Cheap (one indexed lookup on students.role_id
 * + one PK lookup on role_baselines).
 */
export async function loadBaselinesForStudent(
  supabase: SupabaseClient,
  studentId: string
): Promise<Baselines> {
  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("role_id")
    .eq("id", studentId)
    .maybeSingle();
  if (studentErr) {
    console.error(
      "[baselines] students lookup failed, using flat 80:",
      studentErr.message
    );
    return flatBaselines();
  }
  const roleId = (studentRow as { role_id?: string | null } | null)?.role_id;
  if (!roleId) return flatBaselines();

  return loadBaselinesForRole(supabase, roleId);
}

/**
 * Load the per-skill baseline for a role directly. Useful when the caller
 * already knows the role id (employer rollup, role-edit screen).
 */
export async function loadBaselinesForRole(
  supabase: SupabaseClient,
  roleId: string
): Promise<Baselines> {
  const { data: rows, error } = await supabase
    .from("role_baselines")
    .select("skill, min_score")
    .eq("role_id", roleId);
  if (error) {
    console.error(
      "[baselines] role_baselines lookup failed, using flat 80:",
      error.message
    );
    return flatBaselines();
  }
  const result = flatBaselines();
  for (const row of rows ?? []) {
    const r = row as { skill: SkillKey; min_score: number };
    if (SKILL_KEYS.includes(r.skill)) {
      result[r.skill] = r.min_score;
    }
  }
  return result;
}
