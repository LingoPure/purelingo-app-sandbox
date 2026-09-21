/**
 * Email-sprint evaluator.
 *
 * Reads the student's submitted email + the original prompt, runs Claude
 * scoring, upserts gap_scores (source='lesson') for the 3 sub-skills the
 * email exercises, awards XP, marks the lesson complete with score_after.
 */

import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructured,
} from "@/lib/llm/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVALUATOR_SYSTEM_PROMPT,
  EmailSprintEvaluationSchema,
  type EmailSprintEvaluation,
  type EmailSprintPrompt,
} from "./email-sprint-rubric";
import {
  loadBaselinesForStudent,
  FLAT_FALLBACK_TARGET,
} from "@/lib/scoring/baselines";
import { setCanonicalGapScores } from "@/lib/scoring/set-canonical";
import type { AnySkillKey } from "@/lib/scoring/rubric";

export type SubmitInput = {
  lessonId: string;
  studentId: string;
  submission: string;
};

export type SubmitResult = {
  evaluation: EmailSprintEvaluation;
  xpAwarded: number;
  scoreAfter: number;
};

function client() {
  return anthropicClient();
}

export async function submitEmailSprint(
  supabase: SupabaseClient,
  input: SubmitInput
): Promise<SubmitResult> {
  // 1. Load the lesson + the original prompt the generator produced.
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
  if ((lesson as { type: string }).type !== "email_sprint") {
    throw new Error(`Cannot evaluate non-email-sprint lesson (${(lesson as { type: string }).type})`);
  }
  if ((lesson as { status: string }).status === "completed") {
    throw new Error("Lesson already completed");
  }

  const content = (lesson as { content_json: { prompt?: EmailSprintPrompt } })
    .content_json;
  const prompt = content?.prompt;
  if (!prompt) throw new Error("Lesson has no prompt — corrupted state");

  // 2. Run Claude evaluator.
  const evaluation = await evaluateEmail(prompt, input.submission);

  // 3. Upsert gap_scores for the 3 sub-skills the email exercises.
  // Target per skill is the student's role baseline (or flat 80 if
  // unassigned) — same as the discovery scoring path.
  const baselines = await loadBaselinesForStudent(supabase, input.studentId);
  // business_vocabulary is a supporting measure — no role-specific baseline
  // (Baselines only carries the 6 primary keys), so it falls through to the
  // flat 800 default.
  const baselinesAny = baselines as Partial<Record<AnySkillKey, number>>;
  const subSkills = [
    { skill: "writing", sub: evaluation.writing },
    { skill: "business_vocabulary", sub: evaluation.business_vocabulary },
    { skill: "reading", sub: evaluation.reading },
  ] as const;

  await setCanonicalGapScores(
    supabase,
    subSkills.map(({ skill, sub }) => ({
      studentId: input.studentId,
      skill,
      score: sub.score,
      target: baselinesAny[skill] ?? FLAT_FALLBACK_TARGET,
      source: "lesson",
    }))
  );

  // 4. Compute the post-lesson average for score_after tracking.
  const scoreAfter = Math.round(
    (evaluation.writing.score +
      evaluation.business_vocabulary.score +
      evaluation.reading.score) /
      3
  );

  // 5. Mark lesson complete + persist submission + evaluation.
  const { error: lessonUpdateErr } = await supabase
    .from("micro_lessons")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      content_json: { prompt, submission: input.submission, evaluation },
      xp_awarded: evaluation.xp_awarded,
      score_after: scoreAfter,
    })
    .eq("id", input.lessonId)
    .eq("student_id", input.studentId);
  if (lessonUpdateErr) {
    throw new Error(`micro_lessons update failed: ${lessonUpdateErr.message}`);
  }

  // 6. Bump the student's lifetime XP + streak (best-effort).
  const { awardXp } = await import("@/lib/gamification/award");
  await awardXp(input.studentId, evaluation.xp_awarded, supabase);

  return {
    evaluation,
    xpAwarded: evaluation.xp_awarded,
    scoreAfter,
  };
}

async function evaluateEmail(
  prompt: EmailSprintPrompt,
  submission: string
): Promise<EmailSprintEvaluation> {
  const anthropic = client();

  const userMessage = [
    "## PROMPT given to the student",
    "",
    `Scenario: ${prompt.scenario}`,
    `Task: ${prompt.task}`,
    `Recipient: ${prompt.recipient}`,
    `Difficulty band: ${prompt.difficulty_band}`,
    `Expected length: ~${prompt.expected_word_count} words`,
    "",
    "Success criteria the prompt expected:",
    ...prompt.success_criteria.map((c, i) => `  ${i + 1}. ${c}`),
    "",
    "## STUDENT'S SUBMISSION",
    "",
    submission,
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
          text: EVALUATOR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    EmailSprintEvaluationSchema
  );

  return parsed;
}
