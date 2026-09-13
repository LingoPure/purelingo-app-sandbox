/**
 * Live-class scoring orchestrator.
 *
 * Inputs : sessionId (classin_sessions.id), transcript text
 * Effects:
 *   - Calls Claude with the session rubric
 *   - Upserts gap_scores rows ONLY for sub-skills the session exercised
 *     (source='session'); leaves the others alone — discovery scores remain
 *     authoritative until a session disproves them
 *   - Writes participation_summary into classin_sessions.participation_data_json
 *   - Stamps transcribed_at = now()
 */

import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructuredFull,
} from "@/lib/llm/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SESSION_SYSTEM_PROMPT,
  SessionScoresSchema,
  type SessionScoresOutput,
} from "./session-rubric";
import { SKILL_KEYS } from "./rubric";
import { setCanonicalGapScores } from "./set-canonical";

export type ScoreSessionInput = {
  sessionId: string;
  studentId: string;
  transcript: string;
};

export type ScoreSessionResult = {
  scores: SessionScoresOutput;
  skillsUpdated: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

function client() {
  return anthropicClient();
}

export async function scoreSession(
  supabase: SupabaseClient,
  input: ScoreSessionInput
): Promise<ScoreSessionResult> {
  const trimmed = input.transcript.trim();
  if (!trimmed) throw new Error("Cannot score an empty transcript");

  const anthropic = client();

  const { output: parsed, usage } = await parseStructuredFull(
    anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SESSION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the live-class transcript. Score the student now.\n\n${trimmed}`,
        },
      ],
    },
    SessionScoresSchema
  );

  // Only write sub-skills that came back non-null — never overwrite a prior
  // score with "we didn't assess this today".
  const skillsUpdated: string[] = [];
  const writes = SKILL_KEYS.flatMap((skill) => {
    const sub = parsed[skill];
    if (!sub) return [];
    skillsUpdated.push(skill);
    return [
      {
        studentId: input.studentId,
        skill,
        score: sub.score,
        target: 800,
        source: "session" as const,
      },
    ];
  });

  if (writes.length > 0) {
    await setCanonicalGapScores(supabase, writes);
  }

  const { error: sessErr } = await supabase
    .from("classin_sessions")
    .update({
      participation_data_json: {
        participation_summary: parsed.participation_summary,
        overall_cefr: parsed.overall_cefr,
        sub_scores: parsed,
      },
      transcribed_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId)
    .eq("student_id", input.studentId);
  if (sessErr) {
    console.error(
      "[score-session] classin_sessions update failed:",
      sessErr.message
    );
  }

  return {
    scores: parsed,
    skillsUpdated,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}
