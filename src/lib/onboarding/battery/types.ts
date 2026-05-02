/**
 * Phase 0b assessment-battery type definitions.
 *
 * Single source of truth for the four task-type discriminated unions. Every
 * consumer that reads `discovery_task_prompts.prompt_public`,
 * `discovery_task_prompts.prompt_private`, or
 * `discovery_task_responses.response_json` MUST route through the parsers
 * exported here — no `as any` access on those JSONB columns.
 *
 * Spec: docs/phase-0b-assessment-battery.md §10b.
 */

import { z } from "zod";

export const TASK_TYPES = [
  "email_writing",
  "listen_paraphrase",
  "read_summarise",
  "vocab_cloze",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

// ─── Public prompt halves (rendered to the student) ──────────────────────────

const EmailWritingPromptPublic = z.object({
  scenario: z.string().min(1),
  target_word_count: z.object({ min: z.number().int(), max: z.number().int() }),
  persona: z.string().min(1),
  instructions: z.string().min(1),
});

const ListenParaphrasePromptPublic = z.object({
  // The audio_url is a route under our control that streams TTS-generated MP3
  // audio from prompt_private.transcript via service role. The student never
  // sees the transcript text; they hear it once. Optional in storage —
  // the loader on the battery page injects it from the prompt_id so the
  // seed row stays environment-portable.
  audio_url: z.string().min(1).optional(),
  instructions: z.string().min(1),
  plays_allowed: z.number().int().min(1).max(3).default(1),
});

const ReadSummarisePromptPublic = z.object({
  body: z.string().min(1),
  instructions: z.string().min(1),
});

const VocabClozeItemPublic = z.object({
  id: z.string().min(1),
  stem: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
});

const VocabClozePromptPublic = z.object({
  instructions: z.string().min(1),
  items: z.array(VocabClozeItemPublic).min(4).max(12),
});

export const TaskPromptPublicSchema = z.discriminatedUnion("task_type", [
  z.object({ task_type: z.literal("email_writing"), data: EmailWritingPromptPublic }),
  z.object({ task_type: z.literal("listen_paraphrase"), data: ListenParaphrasePromptPublic }),
  z.object({ task_type: z.literal("read_summarise"), data: ReadSummarisePromptPublic }),
  z.object({ task_type: z.literal("vocab_cloze"), data: VocabClozePromptPublic }),
]);
export type TaskPromptPublic = z.infer<typeof TaskPromptPublicSchema>;

// ─── Private prompt halves (service role only — answers / rubrics) ───────────

const EmailWritingPromptPrivate = z.object({
  rubric_anchors: z.object({
    register_tone: z.string(),
    structural_integrity: z.string(),
    strategic_content: z.string(),
    lexical_range: z.string(),
  }),
});

const ListenParaphrasePromptPrivate = z.object({
  transcript: z.string().min(1),
  key_points: z.array(z.string().min(1)).min(2).max(6),
});

const ReadSummarisePromptPrivate = z.object({
  surface_ask: z.string().min(1),
  subtext: z.string().min(1),
  expected_summary_outline: z.string().min(1),
});

const VocabClozeItemPrivate = z.object({
  id: z.string().min(1),
  correct: z.string().min(1),
  difficulty_weight: z.number().min(0).max(2).default(1),
  rationale: z.string().min(1),
});

const VocabClozePromptPrivate = z.object({
  items: z.array(VocabClozeItemPrivate).min(4).max(12),
});

export const TaskPromptPrivateSchema = z.discriminatedUnion("task_type", [
  z.object({ task_type: z.literal("email_writing"), data: EmailWritingPromptPrivate }),
  z.object({ task_type: z.literal("listen_paraphrase"), data: ListenParaphrasePromptPrivate }),
  z.object({ task_type: z.literal("read_summarise"), data: ReadSummarisePromptPrivate }),
  z.object({ task_type: z.literal("vocab_cloze"), data: VocabClozePromptPrivate }),
]);
export type TaskPromptPrivate = z.infer<typeof TaskPromptPrivateSchema>;

// ─── Student responses ───────────────────────────────────────────────────────

const EmailWritingResponse = z.object({
  text: z.string().min(1),
  word_count: z.number().int().nonnegative(),
  paste_count: z.number().int().nonnegative(),
  total_keystrokes: z.number().int().nonnegative(),
  total_seconds: z.number().nonnegative(),
});

const ListenParaphraseResponse = z.object({
  points: z.array(z.string().min(1)).min(1).max(8),
  plays_used: z.number().int().min(0),
});

const ReadSummariseResponse = z.object({
  summary: z.string().min(1),
  total_seconds: z.number().nonnegative(),
});

const VocabClozeResponse = z.object({
  // selected[i] aligns with prompt_public.items[i].id via the answers map.
  answers: z.array(
    z.object({
      item_id: z.string().min(1),
      selected: z.string().min(1),
      time_taken_ms: z.number().int().nonnegative(),
    })
  ).min(1),
});

export const TaskResponseSchema = z.discriminatedUnion("task_type", [
  z.object({ task_type: z.literal("email_writing"), data: EmailWritingResponse }),
  z.object({ task_type: z.literal("listen_paraphrase"), data: ListenParaphraseResponse }),
  z.object({ task_type: z.literal("read_summarise"), data: ReadSummariseResponse }),
  z.object({ task_type: z.literal("vocab_cloze"), data: VocabClozeResponse }),
]);
export type TaskResponse = z.infer<typeof TaskResponseSchema>;

// ─── Parsers (the only sanctioned way to read the JSONB columns) ─────────────

export function parseTaskPromptPublic(
  task_type: TaskType,
  raw: unknown
): TaskPromptPublic {
  return TaskPromptPublicSchema.parse({ task_type, data: raw });
}

export function parseTaskPromptPrivate(
  task_type: TaskType,
  raw: unknown
): TaskPromptPrivate {
  return TaskPromptPrivateSchema.parse({ task_type, data: raw });
}

export function parseTaskResponse(
  task_type: TaskType,
  raw: unknown
): TaskResponse {
  return TaskResponseSchema.parse({ task_type, data: raw });
}

// ─── Skill mapping (spec §8) ─────────────────────────────────────────────────

import type { SkillKey } from "@/lib/scoring/rubric";

/**
 * Per-task → skill mapping. Battery-sourced rows mark these skills canonical;
 * the previous voice-sourced rows for the same skills become non-canonical.
 *
 *   email_writing      → writing_formal
 *   listen_paraphrase  → listening_comprehension
 *   read_summarise     → reading_intent
 *   vocab_cloze        → business_vocabulary
 *
 * Voice-only skills NOT touched by the battery: speaking_fluency,
 * presentation_delivery — the voice transcript stays canonical for those.
 */
export const TASK_SKILL: Record<TaskType, SkillKey> = {
  email_writing: "writing_formal",
  listen_paraphrase: "listening_comprehension",
  read_summarise: "reading_intent",
  vocab_cloze: "business_vocabulary",
};
