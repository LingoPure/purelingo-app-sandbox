/**
 * Programme snapshot — the persisted, immutable counterpart to the
 * sales-preview /plan page's ephemeral buildPlan() output.
 *
 * buildPlan() recomputes phases/totalWeeks fresh from live gap_scores on
 * every call, so it can't answer "which week of the programme is this
 * student in" — the shape can change under them between requests. This
 * module snapshots the parts needed for cadence tracking (phase windows +
 * per-skill weekly targets, derived from the SAME generateLessonPlan()
 * recommendations and PRIORITY_TIMES_PER_WEEK mapping buildPlan() uses) at
 * the moment a student's programme becomes real — discovery_status
 * turning 'complete' — and never edits it: a later re-assessment creates a
 * new active row and supersedes the old one.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPlan, computePhaseWindows, PRIORITY_TIMES_PER_WEEK } from "./plan-delivery";

export type ProgrammeSkillTarget = {
  skill: string;
  label: string;
  kind: "micro_lesson" | "ai_voice" | "class";
  timesPerWeek: number;
  ctaHref: string;
};

export type ProgrammePhaseWindow = {
  name: string;
  weekStart: number;
  weekEnd: number;
};

/**
 * Builds the row payload for a new snapshot from the student's CURRENT
 * gap-driven plan. Skill targets apply across the whole programme rather
 * than varying per phase — buildPhases()'s first/last-phase activity
 * variation (e.g. a phase-2-only role-play simulation) is sales-preview
 * framing, not something the cadence rule needs to track compliance
 * against.
 */
export async function buildProgrammeSnapshotPayload(
  supabase: SupabaseClient,
  studentId: string
): Promise<{
  target_level: string;
  total_weeks: number;
  phases: (ProgrammePhaseWindow & { skill_targets: ProgrammeSkillTarget[] })[];
}> {
  const plan = await buildPlan(supabase, studentId);

  const skillTargets: ProgrammeSkillTarget[] = plan.recommendations
    .filter((r) => r.priority !== "optional")
    .map((r) => ({
      skill: r.skill,
      label: r.skillLabel,
      kind: r.kind,
      timesPerWeek: PRIORITY_TIMES_PER_WEEK[r.priority],
      ctaHref: r.ctaHref,
    }));

  const windows = computePhaseWindows(plan.totalWeeks);
  const phases = windows.map((w) => ({ ...w, skill_targets: skillTargets }));

  return {
    target_level: plan.targetLevel,
    total_weeks: plan.totalWeeks,
    phases,
  };
}

/**
 * Supersedes any existing active snapshot and inserts a fresh one from the
 * student's current plan. Best-effort — the caller (the discovery webhook)
 * must not let this fail the request; log and move on.
 */
export async function createOrSupersedeProgrammeSnapshot(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const payload = await buildProgrammeSnapshotPayload(supabase, studentId);

    const { error: supersedeErr } = await supabase
      .from("programme_snapshots")
      .update({ status: "superseded", superseded_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("status", "active");
    if (supersedeErr) {
      return { ok: false, error: `supersede failed: ${supersedeErr.message}` };
    }

    const { data, error: insertErr } = await supabase
      .from("programme_snapshots")
      .insert({
        student_id: studentId,
        target_level: payload.target_level,
        total_weeks: payload.total_weeks,
        phases: payload.phases,
      })
      .select("id")
      .single();
    if (insertErr || !data) {
      return { ok: false, error: `insert failed: ${insertErr?.message ?? "no row returned"}` };
    }
    return { ok: true, id: data.id as string };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
