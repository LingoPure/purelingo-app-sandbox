/**
 * Shared helper: write a canonical row to gap_scores and demote the
 * previous canonical row for the same (student, skill) to is_canonical=false.
 *
 * Background: migration 0017 relaxed gap_scores' unique constraint from
 * (student_id, skill) to (student_id, skill, source). That lets us keep
 * voice + battery + lesson rows side-by-side per skill for audit, but it
 * also means the dashboard ("WHERE is_canonical = true") expects exactly
 * one canonical row per skill — every writer that wants its row on the
 * radar must demote the prior canonical row first.
 *
 * Use this helper from every gap_scores write path:
 *   - voice scoring (score-discovery.ts) — discovery rows are canonical
 *     until a battery / lesson overrides
 *   - battery scoring (battery/reconcile.ts) — battery rows demote voice
 *   - lesson scoring (email-sprint-evaluate, speak-score-evaluate) —
 *     freshest evidence wins
 *   - ClassIn session scoring (score-session.ts) — same
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillKey } from "@/lib/scoring/rubric";

export type GapScoreSource =
  | "discovery"
  | "lesson"
  | "session"
  | "exam"
  | "voice_transcript"
  | "battery_task";

export type CanonicalWrite = {
  studentId: string;
  skill: SkillKey;
  score: number;
  target: number;
  source: GapScoreSource;
};

/**
 * Write a single canonical gap_scores row.
 *
 *   1. Demote any existing canonical row for (studentId, skill) — except
 *      a row that already shares this source (it will be replaced by the
 *      upsert below).
 *   2. Upsert the new row with is_canonical=true on conflict
 *      (student_id, skill, source).
 */
export async function setCanonicalGapScore(
  supabase: SupabaseClient,
  args: CanonicalWrite
): Promise<void> {
  const { error: demoteErr } = await supabase
    .from("gap_scores")
    .update({ is_canonical: false })
    .eq("student_id", args.studentId)
    .eq("skill", args.skill)
    .eq("is_canonical", true)
    .neq("source", args.source);
  if (demoteErr) {
    throw new Error(`gap_scores demote failed: ${demoteErr.message}`);
  }

  const { error: upsertErr } = await supabase
    .from("gap_scores")
    .upsert(
      {
        student_id: args.studentId,
        skill: args.skill,
        score: args.score,
        target: args.target,
        source: args.source,
        is_canonical: true,
      },
      { onConflict: "student_id,skill,source" }
    );
  if (upsertErr) {
    throw new Error(`gap_scores upsert failed: ${upsertErr.message}`);
  }

  // Append to the immutable progress trail (gap_score_history). One row per scoring
  // event — never overwritten — so the dashboard can chart score-over-time. Non-fatal:
  // a failed history insert must not break the canonical score write above.
  const { error: historyErr } = await supabase
    .from("gap_score_history")
    .insert({
      student_id: args.studentId,
      skill: args.skill,
      score: args.score,
      target: args.target,
      source: args.source,
    });
  if (historyErr) {
    console.error(`gap_score_history insert failed: ${historyErr.message}`);
  }
}

/**
 * Bulk version — writes a batch of canonical rows. Use when one writer
 * produces multiple skills at once (the voice scorer writes 6, the email
 * sprint evaluator writes 3, etc.).
 *
 * Implemented as a sequence of single writes rather than one bulk upsert
 * so each row gets its own demote step (different prior canonical rows
 * per skill).
 */
export async function setCanonicalGapScores(
  supabase: SupabaseClient,
  rows: CanonicalWrite[]
): Promise<void> {
  for (const row of rows) {
    await setCanonicalGapScore(supabase, row);
  }
}
