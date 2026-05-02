/**
 * Discovery-session scoring engine.
 *
 * Called server-side either from:
 *   - the convai webhook (immediately after a discovery call wraps), or
 *   - POST /api/scoring/discovery (manual re-score from the dashboard).
 *
 * Inputs : student_id + transcript turns
 * Outputs: 6 rows in public.gap_scores (one per skill, source='discovery')
 *          + profile_json on the matching public.discovery_sessions row.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GapScoresSchema,
  SKILL_KEYS,
  SYSTEM_PROMPT,
  type GapScoresOutput,
} from "./rubric";
import { loadBaselinesForStudent } from "./baselines";
import { setCanonicalGapScores } from "./set-canonical";

export type TranscriptTurn = {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
};

export type ScoreDiscoveryInput = {
  studentId: string;
  conversationId: string;
  transcript: TranscriptTurn[];
};

export type ScoreDiscoveryResult = {
  scores: GapScoresOutput;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

// Briefing §06 picked claude-sonnet-4-6 for cost/latency on per-call scoring.
// Opus is overkill here — the rubric is prescriptive and the schema is strict.
const MODEL = "claude-sonnet-4-6";

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
}

export async function scoreDiscoverySession(
  supabase: SupabaseClient,
  input: ScoreDiscoveryInput
): Promise<ScoreDiscoveryResult> {
  if (!input.transcript.length) {
    throw new Error("Cannot score an empty transcript");
  }

  const anthropic = client();

  const userMessage = JSON.stringify(
    input.transcript.map((t) => ({ role: t.role, message: t.message }))
  );

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Here is the discovery-session transcript. Score the student now.\n\n${userMessage}`,
      },
    ],
    output_config: { format: zodOutputFormat(GapScoresSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Claude returned no parsed output");
  }

  const usage = response.usage;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage?.cache_creation_input_tokens ?? 0;

  // Per-skill baseline from the student's assigned role (or flat 80 if
  // unassigned). The dashboard radar's target line, the lesson
  // generators' calibration, and the employer "meets baseline" rollup
  // all read this column.
  const baselines = await loadBaselinesForStudent(supabase, input.studentId);

  // Persist sub-scores via the shared canonical writer. Discovery is
  // canonical for every skill at first; battery / lesson scorers later
  // demote individual skill rows as they produce fresher evidence.
  await setCanonicalGapScores(
    supabase,
    SKILL_KEYS.map((skill) => ({
      studentId: input.studentId,
      skill,
      score: parsed[skill].score,
      target: baselines[skill],
      source: "discovery",
    }))
  );

  // Update discovery_sessions.profile_json with the full structured rubric output
  // (evidence strings, target_level + WHY, learning style, summary).
  const { error: discErr } = await supabase
    .from("discovery_sessions")
    .update({ profile_json: parsed })
    .eq("convai_conversation_id", input.conversationId);
  if (discErr) {
    console.error(
      "[score-discovery] profile_json update failed:",
      discErr.message
    );
  }

  // Update the student's target_level on file from what they actually told Aria.
  const { error: studentErr } = await supabase
    .from("students")
    .update({ target_level: parsed.target_level })
    .eq("id", input.studentId);
  if (studentErr) {
    console.error(
      "[score-discovery] students.target_level update failed:",
      studentErr.message
    );
  }

  return {
    scores: parsed,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  };
}
