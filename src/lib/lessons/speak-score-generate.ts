/**
 * Speak-score lesson generator.
 *
 * Mirrors the email-sprint generator: loads gap profile + role context,
 * asks Claude to produce a calibrated speaking prompt, inserts a
 * micro_lessons row with status='active'.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SPEAK_SCORE_GENERATOR_PROMPT,
  SpeakScorePromptSchema,
  type SpeakScorePrompt,
} from "./speak-score-rubric";
import { SKILL_KEYS } from "@/lib/scoring/rubric";
import { loadStudentContext } from "./email-sprint-generate";

const MODEL = "claude-sonnet-4-6";

export type GenerateInput = {
  studentId: string;
};

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
}

export async function generateSpeakScorePrompt(
  ctx: Awaited<ReturnType<typeof loadStudentContext>>
): Promise<SpeakScorePrompt> {
  const anthropic = client();

  const userMessage = [
    "Generate a calibrated speak-score prompt for this student.",
    "",
    `Target level: ${ctx.targetLevel}`,
    "",
    "Current sub-scores (0–100, null = not yet assessed):",
    ...SKILL_KEYS.map((k) => `  - ${k}: ${ctx.scoresByKey[k] ?? "—"}`),
    "",
    "Role / discovery context:",
    ctx.summary
      ? ctx.summary
      : "  (no discovery profile on file — assume mid-career B2B account manager in Vietnam)",
    "",
    ctx.recentScenario
      ? `Their last lesson scenario was: "${ctx.recentScenario}". Pick a different one.`
      : "This is their first lesson.",
  ].join("\n");

  const response = await anthropic.messages.parse({
    model: MODEL,
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
    output_config: { format: zodOutputFormat(SpeakScorePromptSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Generator returned no parsed output");
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
      skill_focus: "speaking_fluency",
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
    ? ["speaking_fluency", "business_vocabulary", "presentation_delivery"]
    : ["speaking_fluency", "business_vocabulary"];
  const relevant = keys
    .map((k) => scores[k])
    .filter((s): s is number => s !== null);
  if (relevant.length === 0) return null;
  return Math.round(relevant.reduce((a, b) => a + b, 0) / relevant.length);
}
