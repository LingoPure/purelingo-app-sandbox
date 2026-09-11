/**
 * BPO Harness — baseline vs trained delta report (BH-005).
 *
 * Computes the improvement story that §12 rolls into org intelligence:
 *   baseline (source='workplace') → trained (source='workplace_trained')
 * per agent, per skill, per role — the numbers a trainer-ready BPO buys.
 *
 * The pure core (`computeDelta`) is DB-agnostic and unit-testable; the
 * DB-backed loader (`loadDeltaReport`) resolves agents via students,
 * pulls both source cohorts, and reuses the pure core.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SKILL_KEYS = [
  "speaking_fluency",
  "listening_comprehension",
  "writing_formal",
  "reading_intent",
  "business_vocabulary",
  "presentation_delivery",
] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export interface SkillScore {
  skill: SkillKey;
  baseline: number | null;
  trained: number | null;
  delta: number | null;
}

export interface AgentDelta {
  studentId: string;
  name: string;
  role: string;
  team: string;
  skills: SkillScore[];
  overall: number | null; // mean delta across skills with both scores
}

export interface DeltaReport {
  agents: AgentDelta[];
  byRole: Record<string, { agents: number; improvement: number }>;
  employerImprovement: number | null;
}

export type ScoreSet = Record<
  string, // studentId
  Partial<Record<SkillKey, { score: number; source: "workplace" | "workplace_trained" }>>
>;

/**
 * Pure core: given both cohorts of scores, produce per-agent deltas + rollups.
 * Deterministic — unit-testable without any database.
 */
export function computeDelta(
  baseline: ScoreSet,
  trained: ScoreSet,
  roster: Array<{ studentId: string; name: string; role: string; team: string }>
): DeltaReport {
  const agents: AgentDelta[] = [];
  const byRole: Record<string, { agents: number; improvement: number }> = {};

  for (const member of roster) {
    const b = baseline[member.studentId] ?? {};
    const t = trained[member.studentId] ?? {};

    const skills: SkillScore[] = SKILL_KEYS.map((skill) => {
      const baselineScore = b[skill]?.score ?? null;
      const trainedScore = t[skill]?.score ?? null;
      const paired = baselineScore !== null && trainedScore !== null;
      return {
        skill,
        baseline: baselineScore,
        trained: trainedScore,
        delta: paired ? trainedScore! - baselineScore! : null,
      };
    });

    const scoredDeltas = skills
      .filter((s) => s.delta !== null)
      .map((s) => s.delta as number);
    const overall =
      scoredDeltas.length > 0
        ? Math.round((scoredDeltas.reduce((a, c) => a + c, 0) / scoredDeltas.length) * 10) / 10
        : null;

    const role = member.role || "unknown";
    const agg = byRole[role] ?? { agents: 0, improvement: 0 };
    if (overall !== null) {
      agg.agents += 1;
      agg.improvement += overall;
    }
    byRole[role] = agg;

    agents.push({ studentId: member.studentId, name: member.name, role, team: member.team, skills, overall });
  }

  // Finalise role averages + employer mean.
  let employerSum = 0;
  let employerCount = 0;
  for (const key of Object.keys(byRole)) {
    const agg = byRole[key];
    agg.improvement = Math.round((agg.improvement / agg.agents) * 10) / 10;
    employerSum += agg.improvement;
    employerCount += 1;
  }

  return {
    agents,
    byRole,
    employerImprovement:
      employerCount > 0 ? Math.round((employerSum / employerCount) * 10) / 10 : null,
  };
}

/**
 * DB-backed loader: pull both source cohorts for an employer and build the report.
 * Resolves agents via students (employer-scoped), matching the harness cohort.
 */
export async function loadDeltaReport(
  admin: SupabaseClient,
  employerId: string
): Promise<DeltaReport> {
  const { data: students, error: studentsErr } = await admin
    .from("students")
    .select("id, name, role_id, employer_id, roles(name)")
    .eq("employer_id", employerId);
  if (studentsErr) {
    throw new Error(`students query failed: ${studentsErr.message}`);
  }

  const studentIds = (students ?? []).map((s) => String(s.id));
  if (studentIds.length === 0) {
    return { agents: [], byRole: {}, employerImprovement: null };
  }

  const { data: scores, error: scoresErr } = await admin
    .from("gap_scores")
    .select("student_id, skill, score, source, students(name)")
    .in("student_id", studentIds)
    .in("source", ["workplace", "workplace_trained"]);
  if (scoresErr) {
    throw new Error(`gap_scores query failed: ${scoresErr.message}`);
  }

  // Roster closes over role names + teams from the generator conventions.
  const roster = (students ?? []).map((s) => ({
    studentId: String(s.id),
    name: String(s.name),
    role: (s.roles as { name?: string } | null)?.name ?? "unknown",
    team: "alpha",
  }));

  const baseline: ScoreSet = {};
  const trained: ScoreSet = {};
  for (const row of scores ?? []) {
    const skill = row.skill as SkillKey;
    if (!SKILL_KEYS.includes(skill)) continue;
    const target =
      row.source === "workplace_trained" ? trained : baseline;
    target[String(row.student_id)] ??= {} as ScoreSet[string];
    target[String(row.student_id)][skill] = { score: Number(row.score), source: row.source };
  }

  return computeDelta(baseline, trained, roster);
}