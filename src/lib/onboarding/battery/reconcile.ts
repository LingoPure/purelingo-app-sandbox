/**
 * Phase 0b unified-scorer reconciliation.
 *
 * Battery responses are scored in score.ts. Once a battery task has a
 * fresh score, this writes the canonical gap_scores row for the matching
 * skill via the shared setCanonicalGapScore helper, which:
 *
 *   - demotes any prior canonical row for (student, skill) to is_canonical=false
 *   - upserts the new battery_task row with is_canonical=true
 *
 * Skill mapping (spec §8):
 *   email_writing      → writing_formal           (battery wins)
 *   listen_paraphrase  → listening_comprehension  (battery wins)
 *   read_summarise     → reading_intent           (battery wins)
 *   vocab_cloze        → business_vocabulary      (battery wins)
 *
 * Voice keeps canonical for: speaking_fluency, presentation_delivery
 * (no battery task — voice is the only signal there).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_SKILL, type TaskType } from "./types";
import { loadBaselinesForStudent } from "@/lib/scoring/baselines";
import { setCanonicalGapScore } from "@/lib/scoring/set-canonical";
import { sendBatteryCompleteReport } from "./report";

export async function reconcileBatteryScore(
  supabase: SupabaseClient,
  studentId: string,
  taskType: TaskType,
  battery: { score: number; cefr_band: string; evidence: string }
): Promise<void> {
  const skill = TASK_SKILL[taskType];
  const baselines = await loadBaselinesForStudent(supabase, studentId);

  await setCanonicalGapScore(supabase, {
    studentId,
    skill,
    score: battery.score,
    target: baselines[skill],
    source: "battery_task",
  });

  // Fire-and-track the battery-complete report email. Best-effort: it
  // catches internally and sends exactly once (4 skills + sent_at guard).
  await sendBatteryCompleteReport(supabase, studentId);
}
