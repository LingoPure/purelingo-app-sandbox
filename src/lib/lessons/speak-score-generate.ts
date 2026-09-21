/**
 * Speak-score lesson generator.
 *
 * Mirrors the email-sprint generator: loads gap profile + role context,
 * asks Claude to produce a calibrated speaking prompt, inserts a
 * micro_lessons row with status='active'.
 */

import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructured,
} from "@/lib/llm/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SPEAK_SCORE_GENERATOR_PROMPT,
  SpeakScorePromptSchema,
  type SpeakScorePrompt,
} from "./speak-score-rubric";
import { SKILL_KEYS } from "@/lib/scoring/rubric";
import { loadStudentContext } from "./email-sprint-generate";

export type GenerateInput = {
  studentId: string;
};

function client() {
  return anthropicClient();
}

export async function generateSpeakScorePrompt(
  ctx: Awaited<ReturnType<typeof loadStudentContext>>
): Promise<SpeakScorePrompt> {
  const anthropic = client();

  const userMessage = [
    "Generate a calibrated speak-score prompt for this student.",
    "",
    ctx.roleName
      ? `Role at employer: ${ctx.roleName}`
      : "Role at employer: (unassigned — calibrate to a generic mid-career B2B Vietnamese context)",
    ctx.roleDescription ? `Role description: ${ctx.roleDescription}` : null,
    "",
    `Personal target level (aspiration): ${ctx.targetLevel}`,
    "",
    "Current sub-scores vs role baseline (the buyer's bar — what we calibrate against):",
    ...SKILL_KEYS.map((k) => {
      const cur = ctx.scoresByKey[k];
      const base = ctx.baselines[k];
      const gap = cur == null ? "—" : `gap ${base - cur}`;
      return `  - ${k}: current ${cur ?? "—"} | baseline ${base} | ${gap}`;
    }),
    "",
    "Speak-score exercises: speaking, business_vocabulary, presentation_delivery (last only when expects_structure=true).",
    "Calibrate the prompt to close the LARGEST relevant gap by ~5–10 points on a strong attempt.",
    "",
    "Role / discovery context:",
    ctx.summary
      ? ctx.summary
      : "  (no discovery profile on file — assume mid-career B2B account manager in Vietnam)",
    "",
    ctx.recentScenario
      ? `Their last lesson scenario was: "${ctx.recentScenario}". Pick a different one.`
      : "This is their first lesson.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const parsed = await parseStructured(
    anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      temperature: 0.7,
      system: [
        {
          type: "text",
          text: SPEAK_SCORE_GENERATOR_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    SpeakScorePromptSchema
  );

  return parsed;
}

export async function createSpeakScoreLesson(
  supabase: SupabaseClient,
  input: GenerateInput
): Promise<{ id: string; prompt: SpeakScorePrompt }> {
  const ctx = await loadStudentContext(supabase, input.studentId);
  const prompt = await generateSpeakScorePrompt(ctx);

  const beforeAvg = averageRelevant(ctx.scoresByKey, prompt.expects_structure);

  const { data, error } = await supabase
    .from("micro_lessons")
    .insert({
      student_id: input.studentId,
      type: "speak_score",
      skill_focus: "speaking",
      content_json: { prompt },
      score_before: beforeAvg,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(`micro_lessons insert failed: ${error.message}`);
  return { id: (data as { id: string }).id, prompt };
}

function averageRelevant(
  scores: Record<string, number | null>,
  expectsStructure: boolean
): number | null {
  const keys = expectsStructure
    ? ["speaking", "business_vocabulary", "presentation_delivery"]
    : ["speaking", "business_vocabulary"];
  const relevant = keys
    .map((k) => scores[k])
    .filter((s): s is number => s !== null);
  if (relevant.length === 0) return null;
  return Math.round(relevant.reduce((a, b) => a + b, 0) / relevant.length);
}
