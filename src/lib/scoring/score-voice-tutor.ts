/**
 * AI voice-tutor session scoring.
 *
 * Called server-side from the convai webhook once a voice-tutor conversation
 * ends. Inputs: student_id, the target skill drilled, transcript turns.
 * Output: ONE gap_scores row (source='ai_voice_tutor'), provenance-tagged,
 * via the shared canonical writer — same demote-then-upsert behaviour every
 * other scorer uses, so a strong drill session can become the canonical
 * score for that skill exactly like a strong ClassIn session already can.
 */
import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructuredFull,
} from "@/lib/llm/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  VoiceTutorScoreSchema,
  VOICE_TUTOR_SYSTEM_PROMPT,
  VOICE_TUTOR_PROMPT_VERSION,
  type VoiceTutorScoreOutput,
} from "./voice-tutor-rubric";
import { loadBaselinesForStudent, FLAT_FALLBACK_TARGET } from "@/lib/scoring/baselines";
import { setCanonicalGapScore } from "@/lib/scoring/set-canonical";
import { RUBRIC_VERSION, type AnySkillKey } from "@/lib/scoring/rubric";

export type VoiceTutorTranscriptTurn = {
  role: "agent" | "user";
  message: string;
};

export type ScoreVoiceTutorInput = {
  studentId: string;
  targetSkill: AnySkillKey;
  transcript: VoiceTutorTranscriptTurn[];
};

export type ScoreVoiceTutorResult = {
  scores: VoiceTutorScoreOutput;
  inputTokens: number;
  outputTokens: number;
};

export async function scoreVoiceTutorSession(
  supabase: SupabaseClient,
  input: ScoreVoiceTutorInput
): Promise<ScoreVoiceTutorResult> {
  if (!input.transcript.length) {
    throw new Error("Cannot score an empty voice-tutor transcript");
  }

  const anthropic = anthropicClient();
  const userMessage = JSON.stringify({
    target_skill: input.targetSkill,
    transcript: input.transcript.map((t) => ({ role: t.role, message: t.message })),
  });

  const { output: parsed, usage } = await parseStructuredFull(
    anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      temperature: 0,
      system: [
        {
          type: "text",
          text: VOICE_TUTOR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the voice-tutor practice transcript. Score the drilled skill now.\n\n${userMessage}`,
        },
      ],
    },
    VoiceTutorScoreSchema
  );

  const baselines = await loadBaselinesForStudent(supabase, input.studentId);
  const baselinesAny = baselines as Partial<Record<AnySkillKey, number>>;

  await setCanonicalGapScore(supabase, {
    studentId: input.studentId,
    skill: input.targetSkill,
    score: parsed.skill.score,
    target: baselinesAny[input.targetSkill] ?? FLAT_FALLBACK_TARGET,
    source: "ai_voice_tutor",
    model: ANTHROPIC_MODEL,
    promptVersion: VOICE_TUTOR_PROMPT_VERSION,
    rubricVersion: RUBRIC_VERSION,
  });

  return {
    scores: parsed,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}
