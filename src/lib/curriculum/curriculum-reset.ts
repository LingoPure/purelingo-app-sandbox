/**
 * LingoPure — Curriculum reset loop (C0 / §2.3, BPO §10.2).
 *
 * Consumes workplace observations (BPO harness → workplace_observations) as
 * the per-student evidence stream and runs the C0 `evaluateReset` gate:
 *   - loads the student's ACTIVE curriculum + plan snapshot
 *   - synthesizes engine observations from new workplace rows
 *   - if the engine says reset: supersedes the old plan, persists the new
 *     ACTIVE version + its lessons, and writes the append-only reset audit row
 *
 * Service-role writes only (no RLS insert policies on curricula tables).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateReset,
  type CurriculumPlan,
  type CurriculumInputsSnapshot,
} from "@/lib/curriculum/curriculum-engine";
import { pseudonymousEmail } from "@/lib/bpo/generator";

export type ObservationRow = {
  pseudonymous_id: string;
  employer_id: string;
  skill: string | null;
  observation: string;
  created_at: string;
};

export type CurriculumSyncResult =
  | { status: "no_plan" }
  | { status: "no_new_evidence" }
  | { status: "no_reset"; to_version: number }
  | { status: "reset"; to_version: number; trigger_type: string; rationale: string };

/** Pure: map workplace rows → engine observation entries for one skill. */
export function synthesizeObservations(
  rows: ObservationRow[],
  ownedSkill: string | null
): CurriculumInputsSnapshot["observations"] {
  return rows
    .filter((r) => r.skill === ownedSkill)
    .map((r) => ({
      skill: r.skill as CurriculumInputsSnapshot["observations"][number]["skill"],
      observation: r.observation,
      created_at: r.created_at,
    }));
}

/**
 * Load the ACTIVE curriculum plan for a student from the persisted plan_jsonb.
 */
export async function loadActivePlan(
  admin: SupabaseClient,
  studentId: string
): Promise<CurriculumPlan | null> {
  const { data, error } = await admin
    .from("curricula")
    .select("plan_jsonb")
    .eq("student_id", studentId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error || !data) return null;
  return data.plan_jsonb as unknown as CurriculumPlan;
}

/**
 * Run the reset loop for one student against new workplace evidence.
 * Persists the supersede + new version when the engine says to reset.
 */
export async function applyWorkplaceEvidence(
  admin: SupabaseClient,
  studentId: string
): Promise<CurriculumSyncResult> {
  const plan = await loadActivePlan(admin, studentId);
  if (!plan) return { status: "no_plan" };

  // Observations written after the plan's last snapshot.
  const { data: rows, error } = await admin
    .from("workplace_observations")
    .select("pseudonymous_id, employer_id, skill, observation, created_at")
    .gte("created_at", plan.last_inputs_snapshot.generated_at);
  if (error) return { status: "no_new_evidence" };

  const notable = (rows ?? []).map((r) => ({
    pseudonymous_id: String(r.pseudonymous_id),
    employer_id: String(r.employer_id),
    skill: r.skill ? String(r.skill) : null,
    observation: String(r.observation),
    created_at: String(r.created_at),
  })) as ObservationRow[];

  // Resolve which observations belong to this student via the harness
  // pseudonymous mapping — the row carries no student_id by design.
  const { data: student } = await admin
    .from("students")
    .select("id, email")
    .eq("id", studentId)
    .maybeSingle();

  const owned = new Set<string>();
  for (const r of notable) {
    const email = student?.email ?? "";
    if (typeof email !== "string") continue;
    if (pseudonymousEmail(r.pseudonymous_id) === email) owned.add(r.pseudonymous_id);
  }
  const myRows = notable.filter((r) => owned.has(r.pseudonymous_id));
  if (!myRows.length) return { status: "no_new_evidence" };

  // One engine observation per skill present in the evidence stream.
  const observedSkills = new Map<string, ObservationRow[]>();
  for (const r of myRows) {
    if (!r.skill) continue;
    const bucket = observedSkills.get(r.skill) ?? [];
    bucket.push(r);
    observedSkills.set(r.skill, bucket);
  }

  const observations: CurriculumInputsSnapshot["observations"] = [];
  for (const [skill, bucket] of observedSkills) {
    observations.push({
      skill: skill as CurriculumInputsSnapshot["observations"][number]["skill"],
      observation: bucket.map((r) => r.observation).join(" | "),
      created_at: bucket[0].created_at,
    });
  }

  const verdict = evaluateReset({
    existing_plan: plan,
    new_completions: [],
    new_feedback: [],
    new_observations: observations,
  });

  if (!verdict.should_reset || !verdict.new_plan || !verdict.reset) {
    return { status: "no_reset", to_version: plan.version };
  }

  // Supersede the old ACTIVE plan and insert the new version atomically.
  const { error: supersedeErr } = await admin
    .from("curricula")
    .update({ status: "SUPERSEDED" })
    .eq("curriculum_id", plan.curriculum_id);
  if (supersedeErr) throw new Error(`curricula supersede failed: ${supersedeErr.message}`);

  const { data: newPlanRow, error: insertErr } = await admin
    .from("curricula")
    .insert({
      student_id: studentId,
      version: verdict.new_plan.version,
      target_level: verdict.new_plan.cefr_target,
      timeline: verdict.new_plan.timeline,
      plan_jsonb: verdict.new_plan,
      status: "ACTIVE",
    })
    .select("curriculum_id")
    .single();
  if (insertErr || !newPlanRow) {
    throw new Error(`curricula v${verdict.new_plan.version} insert failed: ${insertErr?.message}`);
  }

  const lessons = verdict.new_plan.lessons.map((l, i) => ({
    curriculum_id: newPlanRow.curriculum_id,
    modality: l.modality,
    skill: l.skill,
    title: l.title,
    scheduled_at: l.scheduled_at,
    status: "SCHEDULED",
    order_index: i,
  }));
  if (lessons.length) {
    const { error: lErr } = await admin.from("curriculum_lessons").insert(lessons);
    if (lErr) throw new Error(`curriculum_lessons v${verdict.new_plan.version} failed: ${lErr.message}`);
  }

  const { error: resetErr } = await admin.from("curriculum_resets").insert({
    curriculum_id: newPlanRow.curriculum_id,
    student_id: studentId,
    from_version: verdict.reset.from_version,
    to_version: verdict.reset.to_version,
    trigger_type: verdict.reset.trigger_type,
    trigger_key: verdict.reset.trigger_key,
    rationale: verdict.reset.rationale,
    inputs: { observations },
  });
  if (resetErr) throw new Error(`curriculum_resets insert failed: ${resetErr.message}`);

  return {
    status: "reset",
    to_version: verdict.new_plan.version,
    trigger_type: verdict.reset.trigger_type,
    rationale: verdict.reset.rationale,
  };
}

export type OrgSyncSummary = {
  scanned: number;
  resets: Array<{ student_id: string; to_version: number; trigger_type: string }>;
};

/**
 * Sweep every student in an org whose employer linked it, running the reset
 * loop against any new workplace observations. Called from the org sync route.
 * Clears errors per student so one bad student never blocks the sweep.
 */
export async function syncOrgCurricula(
  admin: SupabaseClient,
  organisationId: string,
  opts: { onError?: (studentId: string, err: unknown) => void } = {}
): Promise<OrgSyncSummary> {
  const { data: employerRows } = await admin
    .from("employers")
    .select("id")
    .eq("organisation_id", organisationId);
  const employerIds = (employerRows ?? []).map((e) => e.id as string);
  if (!employerIds.length) return { scanned: 0, resets: [] };

  const { data: studentRows } = await admin
    .from("students")
    .select("id")
    .in("employer_id", employerIds);
  const ids = (studentRows ?? []).map((s) => s.id as string);

  const resets: OrgSyncSummary["resets"] = [];
  for (const id of ids) {
    try {
      const result = await applyWorkplaceEvidence(admin, id);
      if (result.status === "reset") {
        resets.push({
          student_id: id,
          to_version: result.to_version,
          trigger_type: result.trigger_type,
        });
      }
    } catch (err) {
      opts.onError?.(id, err);
    }
  }
  return { scanned: ids.length, resets };
}