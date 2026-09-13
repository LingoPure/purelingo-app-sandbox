/**
 * Speak-score evaluator.
 *
 * Pipeline:
 *   1. Audio Blob → Whisper (gpt-4o-transcribe) → transcript text
 *   2. Transcript + original prompt → Claude evaluator → structured scores
 *   3. Upsert gap_scores (source='lesson') for the 2–3 sub-skills exercised
 *   4. Mark lesson complete with score_after + xp_awarded + transcript +
 *      evaluation in content_json
 */

import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructured,
} from "@/lib/llm/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SPEAK_SCORE_EVALUATOR_PROMPT,
  SpeakScoreEvaluationSchema,
  type SpeakScoreEvaluation,
  type SpeakScorePrompt,
} from "./speak-score-rubric";
import { transcribeAudio } from "@/lib/transcription/whisper";
import {
  loadBaselinesForStudent,
  type Baselines,
} from "@/lib/scoring/baselines";
import { setCanonicalGapScores } from "@/lib/scoring/set-canonical";
import type { SkillKey } from "@/lib/scoring/rubric";

export type SubmitInput = {
  lessonId: string;
  studentId: string;
  audio: Blob;
};

export type SubmitResult = {
  evaluation: SpeakScoreEvaluation;
  transcript: string;
  xpAwarded: number;
  scoreAfter: number;
};

function client() {
  return anthropicClient();
}

export async function submitSpeakScore(
  supabase: SupabaseClient,
  input: SubmitInput
): Promise<SubmitResult> {
  // 1. Load lesson + the prompt the generator stored.
  const { data: lesson, error: lessonErr } = await supabase
    .from("micro_lessons")
    .select("id, student_id, type, content_json, status, score_before")
    .eq("id", input.lessonId)
    .maybeSingle();
  if (lessonErr) throw new Error(`micro_lessons lookup failed: ${lessonErr.message}`);
  if (!lesson) throw new Error("Lesson not found");
  if ((lesson as { student_id: string }).student_id !== input.studentId) {
    throw new Error("Lesson does not belong to this student");
  }
  if ((lesson as { type: string }).type !== "speak_score") {
    throw new Error(
      `Cannot evaluate non-speak-score lesson (${(lesson as { type: string }).type})`
    );
  }
  if ((lesson as { status: string }).status === "completed") {
    throw new Error("Lesson already completed");
  }

  const content = (lesson as { content_json: { prompt?: SpeakScorePrompt } })
    .content_json;
  const prompt = content?.prompt;
  if (!prompt) throw new Error("Lesson has no prompt — corrupted state");

  // 2. Transcribe audio.
  const transcript = await transcribeAudio(input.audio);
  if (!transcript.trim()) {
    throw new Error("Transcription returned empty — no speech detected");
  }

  // 3. Score transcript.
  const evaluation = await evaluateTranscript(prompt, transcript);

  // 4. Upsert gap_scores for sub-skills that were scored (presentation may be null).
  // Target per skill is the student's role baseline (or flat 80 if unassigned).
  const baselines: Baselines = await loadBaselinesForStudent(
    supabase,
    input.studentId
  );
  const subSkills: { skill: SkillKey; score: number }[] = [
    { skill: "speaking_fluency", score: evaluation.speaking_fluency.score },
    { skill: "business_vocabulary", score: evaluation.business_vocabulary.score },
  ];
  if (evaluation.presentation_delivery) {
    subSkills.push({
      skill: "presentation_delivery",
      score: evaluation.presentation_delivery.score,
    });
  }

  await setCanonicalGapScores(
    supabase,
    subSkills.map((s) => ({
      studentId: input.studentId,
      skill: s.skill,
      score: s.score,
      target: baselines[s.skill],
      source: "lesson",
    }))
  );

  // 5. score_after = average across what was scored (used for the dashboard delta).
  const scoreAfter = Math.round(
    subSkills.reduce((sum, s) => sum + s.score, 0) / subSkills.length
  );

  // 6. Mark lesson complete + persist transcript + evaluation.
  const { error: updateErr } = await supabase
    .from("micro_lessons")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      content_json: { prompt, transcript, evaluation },
      xp_awarded: evaluation.xp_awarded,
      score_after: scoreAfter,
    })
    .eq("id", input.lessonId)
    .eq("student_id", input.studentId);
  if (updateErr) throw new Error(`micro_lessons update failed: ${updateErr.message}`);

  // 7. Bump the student's lifetime XP + streak (best-effort).
  const { awardXp } = await import("@/lib/gamification/award");
  await awardXp(input.studentId, evaluation.xp_awarded, supabase);

  return {
    evaluation,
    transcript,
    xpAwarded: evaluation.xp_awarded,
    scoreAfter,
  };
}

async function evaluateTranscript(
  prompt: SpeakScorePrompt,
  transcript: string
): Promise<SpeakScoreEvaluation> {
  const anthropic = client();

  const userMessage = [
    "## PROMPT given to the student",
    "",
    `Scenario: ${prompt.scenario}`,
    `Task: ${prompt.task}`,
    `Difficulty band: ${prompt.difficulty_band}`,
    `Expected length: ~${prompt.expected_seconds} seconds`,
    `Expects structured answer: ${prompt.expects_structure}`,
    "",
    "Success criteria the prompt expected:",
    ...prompt.success_criteria.map((c, i) => `  ${i + 1}. ${c}`),
    "",
    "## STUDENT'S TRANSCRIPT (auto-transcribed from audio)",
    "",
    transcript,
  ].join("\n");

  const parsed = await parseStructured(
    anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SPEAK_SCORE_EVALUATOR_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    SpeakScoreEvaluationSchema
  );

  return parsed;
}
