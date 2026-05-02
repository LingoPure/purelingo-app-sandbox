/**
 * Phase 0b unified-scorer reconciliation.
 *
 * Battery responses are scored in score.ts. Once a battery task has a
 * fresh score, this module:
 *
 *   1. Upserts a row into gap_scores with source='battery_task',
 *      is_canonical=true (unique constraint is now (student_id, skill,
 *      source) since migration 0017).
 *   2. Demotes the matching voice-sourced row (source='discovery') to
 *      is_canonical=false. The voice row stays for audit but the
 *      dashboard radar's `is_canonical=true` filter passes over it.
 *
 * Skill mapping (spec §8):
 *   email_writing      → writing_formal           (battery wins)
 *   listen_paraphrase  → listening_comprehension  (battery wins)
 *   read_summarise     → reading_intent           (battery wins)
 *   vocab_cloze        → business_vocabulary      (battery wins)
 *
 * Voice keeps canonical for: speaking_fluency, presentation_delivery
 * (no battery task — the voice transcript is the only signal).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_SKILL, type TaskType } from "./types";
import { loadBaselinesForStudent } from "@/lib/scoring/baselines";

export async function reconcileBatteryScore(
  supabase: SupabaseClient,
  studentId: string,
  taskType: TaskType,
  battery: { score: number; cefr_band: string; evidence: string }
): Promise<void> {
  const skill = TASK_SKILL[taskType];
  const baselines = await loadBaselinesForStudent(supabase, studentId);

  // 1. Upsert the canonical battery row. (student_id, skill, source) is the
  //    unique key — re-running scoring updates in place rather than
  //    accumulating duplicates.
  const { error: upsertErr } = await supabase
    .from("gap_scores")
    .upsert(
      {
        student_id: studentId,
        skill,
        score: battery.score,
        target: baselines[skill],
        source: "battery_task",
        is_canonical: true,
      },
      { onConflict: "student_id,skill,source" }
    );
  if (upsertErr) {
    throw new Error(`gap_scores upsert (battery) failed: ${upsertErr.message}`);
  }

  // 2. Demote the voice row for this skill. The voice scorer writes
  //    source='discovery' (legacy spelling — kept for back-compat with
  //    the existing convai webhook scoring path).
  const { error: demoteErr } = await supabase
    .from("gap_scores")
    .update({ is_canonical: false })
    .eq("student_id", studentId)
    .eq("skill", skill)
    .eq("source", "discovery");
  if (demoteErr) {
    throw new Error(`gap_scores demote (voice) failed: ${demoteErr.message}`);
  }
}
