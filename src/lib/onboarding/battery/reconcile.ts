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
 * Skill mapping (spec §8; ISS-048 taxonomy):
 *   email_writing      → writing               (battery wins)
 *   listen_paraphrase  → listening             (battery wins)
 *   read_summarise     → reading               (battery wins)
 *   vocab_cloze        → business_vocabulary   (battery wins)
 *
 * Voice keeps canonical for: speaking, grammar, live_interaction,
 * presentation_delivery (no battery task — voice is the only signal there).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_SKILL, type TaskType } from "./types";
import {
  loadBaselinesForStudent,
  FLAT_FALLBACK_TARGET,
} from "@/lib/scoring/baselines";
import { setCanonicalGapScore } from "@/lib/scoring/set-canonical";
import { sendBatteryCompleteReport } from "./report";
import type { AnySkillKey } from "@/lib/scoring/rubric";

export async function reconcileBatteryScore(
  supabase: SupabaseClient,
  studentId: string,
  taskType: TaskType,
  battery: { score: number; cefr_band: string; evidence: string }
): Promise<void> {
  const skill = TASK_SKILL[taskType];
  const baselines = await loadBaselinesForStudent(supabase, studentId);
  // business_vocabulary is a supporting measure — no role-specific baseline
  // (Baselines only carries the 6 primary keys), so it falls through to the
  // flat 800 default.
  const baselinesAny = baselines as Partial<Record<AnySkillKey, number>>;

  await setCanonicalGapScore(supabase, {
    studentId,
    skill,
    score: battery.score,
    target: baselinesAny[skill] ?? FLAT_FALLBACK_TARGET,
    source: "battery_task",
  });

  // Fire-and-track the battery-complete report email. Best-effort: it
  // catches internally and sends exactly once (4 skills + sent_at guard).
  await sendBatteryCompleteReport(supabase, studentId);
}
