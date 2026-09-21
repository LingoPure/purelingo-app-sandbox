/**
 * BPO Harness — §12 Management Intelligence rollup (BH-006).
 *
 * Turns individual communication data into controlled organizational
 * intelligence — capability by role and team, common gaps, training demand,
 * and improvement trend.  Backs `GET /api/bpo/org/[employerId]/intelligence`.
 *
 * Structure:
 *   - buildOrgIntelligence(): PURE aggregator over canonical current scores —
 *     unit-testable without a DB.
 *   - loadOrgIntelligence(): DB-backed loader (students → canonical gap_scores
 *     → computed deltas reused from delta-report).
 *
 * A "gap" is a skill whose cohort mean is >GAP_MARGIN below the target skill
 * value; training demand is the cohort sorted by lowest current overall mean.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadDeltaReport,
  type DeltaReport,
} from "@/lib/bpo/delta-report";
import { agentTeamByName } from "@/lib/bpo/generator";
import {
  SKILL_KEYS as PRIMARY_SKILL_KEYS,
  SUPPORTING_SKILL_KEYS,
  type AnySkillKey,
} from "@/lib/scoring/rubric";

// BPO is "the same one-person shape, scaled to many people" — the cohort
// rollup covers every scored dimension (6 primary + 2 supporting), not just
// the headline bars. Import the canonical taxonomy rather than duplicating
// it locally (ISS-048).
export const SKILL_KEYS = [
  ...PRIMARY_SKILL_KEYS,
  ...SUPPORTING_SKILL_KEYS,
] as const;
export type SkillKey = AnySkillKey;

/** A skill is a common gap when the cohort mean sits this far below target. */
export const GAP_MARGIN = 150;

export interface SkillRollup {
  skill: SkillKey;
  mean: number | null;
  target: number;
  gap: number | null;           // target - mean (positive = below target)
  is_common_gap: boolean;
  agents_scored: number;
}

export interface AgentCurrent {
  studentId: string;
  name: string;
  role: string;
  team: string;
  overall: number | null;
  skills: Partial<Record<SkillKey, number>>;
}

export interface GroupRollup {
  metric: string;   // role name or team name
  kind: "role" | "team";
  skills: Record<SkillKey, number | null>;
  overall: number | null;
}

export interface OrgIntelligence {
  employer_id: string;
  generated_at: string;
  overall_capability: number | null;
  by_role: GroupRollup[];
  by_team: GroupRollup[];
  common_gaps: SkillRollup[];            // sorted worst-first
  training_demand: AgentCurrent[];       // sorted lowest-first
  improvement: {
    employer: number | null;
    by_role: Record<string, number>;
  };
  agents: AgentCurrent[];
}

export interface RawAgentScore {
  student_id: string;
  student_name: string;
  role: string;
  team: string;
  skill: SkillKey;
  score: number;
  target: number;
}

// ─── Pure aggregator ──────────────────────────────────────────────────────────

export function buildOrgIntelligence(
  employerId: string,
  scores: RawAgentScore[],
  delta: DeltaReport
): OrgIntelligence {
  const agents = new Map<string, AgentCurrent>();
  const skillAggregate = new Map<string, { sum: number; count: number; targetSum: number }>();

  for (const s of scores) {
    let agent = agents.get(s.student_id);
    if (!agent) {
      agent = { studentId: s.student_id, name: s.student_name, role: s.role, team: s.team, overall: null, skills: {} };
      agents.set(s.student_id, agent);
    }
    agent.skills[s.skill] = s.score;

    const agg = skillAggregate.get(s.skill) ?? { sum: 0, count: 0, targetSum: 0 };
    agg.sum += s.score;
    agg.count += 1;
    agg.targetSum += s.target;
    skillAggregate.set(s.skill, agg);
  }

  for (const agent of agents.values()) {
    const vals = Object.values(agent.skills).filter((v): v is number => v !== undefined);
    agent.overall = vals.length > 0 ? Math.round(vals.reduce((a, c) => a + c, 0) / vals.length) : null;
  }

  // ── Common gaps (worst-first) ─────────────────────────────────────────────
  const commonGaps: SkillRollup[] = SKILL_KEYS.map((skill) => {
    const agg = skillAggregate.get(skill);
    if (!agg || agg.count === 0) {
      return { skill, mean: null, target: 0, gap: null, is_common_gap: false, agents_scored: 0 };
    }
    const mean = Math.round(agg.sum / agg.count);
    const target = Math.round(agg.targetSum / agg.count);
    const gap = target - mean;
    return {
      skill,
      mean,
      target,
      gap,
      is_common_gap: gap > GAP_MARGIN,
      agents_scored: agg.count,
    };
  }).sort((a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity));

  // ── Capability by role / team ─────────────────────────────────────────────
  const byRole = aggregateGroup(scores, "role");
  const byTeam = aggregateGroup(scores, "team");

  const overallCapability = meanOf(agents);
  const trainingDemand = [...agents.values()]
    .filter((a) => a.overall !== null)
    .sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0))
    .map((a) => ({ ...a, skills: { ...a.skills } }));

  return {
    employer_id: employerId,
    generated_at: new Date().toISOString(),
    overall_capability: overallCapability,
    by_role: byRole,
    by_team: byTeam,
    common_gaps: commonGaps,
    training_demand: trainingDemand,
    improvement: {
      employer: delta.employerImprovement,
      by_role: Object.fromEntries(
        Object.entries(delta.byRole).map(([role, agg]) => [role, agg.improvement])
      ),
    },
    agents: [...agents.values()].map((a) => ({ ...a, skills: { ...a.skills } })),
  };
}

function aggregateGroup(scores: RawAgentScore[], kind: "role" | "team"): GroupRollup[] {
  const groups = new Map<string, { sum: Record<SkillKey, number>; count: Record<SkillKey, number> }>();

  for (const s of scores) {
    const metric = kind === "role" ? s.role : s.team;
    let g = groups.get(metric);
    if (!g) {
      const zero = {} as Record<SkillKey, number>;
      for (const k of SKILL_KEYS) zero[k] = 0;
      g = { sum: { ...zero }, count: { ...zero } };
      groups.set(metric, g);
    }
    g.sum[s.skill] += s.score;
    g.count[s.skill] += 1;
  }

  return [...groups.entries()].map(([metric, g]) => {
    const skills = {} as Record<SkillKey, number | null>;
    let overallSum = 0;
    let overallCount = 0;
    for (const k of SKILL_KEYS) {
      if (g.count[k] > 0) {
        const mean = Math.round(g.sum[k] / g.count[k]);
        skills[k] = mean;
        overallSum += mean;
        overallCount += 1;
      } else {
        skills[k] = null;
      }
    }
    return {
      metric,
      kind,
      skills,
      overall: overallCount > 0 ? Math.round(overallSum / overallCount) : null,
    };
  });
}

function meanOf(agents: Map<string, AgentCurrent>): number | null {
  const vals = [...agents.values()].filter((a) => a.overall !== null).map((a) => a.overall as number);
  return vals.length > 0 ? Math.round(vals.reduce((a, c) => a + c, 0) / vals.length) : null;
}

// ─── DB-backed loader ─────────────────────────────────────────────────────────

export async function loadOrgIntelligence(
  admin: SupabaseClient,
  employerId: string
): Promise<OrgIntelligence> {
  const { data: students, error: studentsErr } = await admin
    .from("students")
    .select("id, name, employer_id, roles(name)")
    .eq("employer_id", employerId);
  if (studentsErr) {
    throw new Error(`students query failed: ${studentsErr.message}`);
  }

  const studentIds = (students ?? []).map((s) => String(s.id));
  const delta = await loadDeltaReport(admin, employerId);

  if (studentIds.length === 0) {
    return buildOrgIntelligence(employerId, [], delta);
  }

  const { data: gapRows, error: gapErr } = await admin
    .from("gap_scores")
    .select("student_id, skill, score, target")
    .in("student_id", studentIds)
    .eq("is_canonical", true);
  if (gapErr) {
    throw new Error(`gap_scores query failed: ${gapErr.message}`);
  }

  const scores: RawAgentScore[] = [];
  for (const row of gapRows ?? []) {
    const student = (students ?? []).find((s) => String(s.id) === String(row.student_id));
    if (!student) continue;
    const skill = row.skill as SkillKey;
    if (!SKILL_KEYS.includes(skill)) continue;
    scores.push({
      student_id: String(row.student_id),
      student_name: String(student.name),
      role: (student.roles as { name?: string } | null)?.name ?? "unknown",
      team: agentTeamByName(String(student.name)),
      skill,
      score: Number(row.score),
      target: Number(row.target ?? 700),
    });
  }

  return buildOrgIntelligence(employerId, scores, delta);
}