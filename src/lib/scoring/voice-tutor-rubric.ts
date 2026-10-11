/**
 * AI voice-tutor scoring rubric.
 *
 * Deliberately narrow — a voice-tutor session drills ONE target skill (the
 * recommendation that triggered it, or the skill the student picked for an
 * on-demand session). This is NOT a repeat of discovery's full 8-dimension
 * pass; it scores only what the session actually drilled, same spirit as
 * session-rubric.ts's "score only what was exercised" rule but scoped to a
 * single skill by design rather than by evidence availability.
 */
import { z } from "zod";
import { SubScore } from "./rubric";

/** Bump whenever VOICE_TUTOR_SYSTEM_PROMPT's text changes. Threaded into
 *  gap_scores.prompt_version alongside RUBRIC_VERSION. */
export const VOICE_TUTOR_PROMPT_VERSION = "1.0.0";

export const VoiceTutorScoreSchema = z.object({
  skill: SubScore,
  coach_note: z
    .string()
    .min(1)
    .max(400)
    .describe(
      "One or two sentences, written for the student: what improved, what to drill next time."
    ),
});

export type VoiceTutorScoreOutput = z.infer<typeof VoiceTutorScoreSchema>;

export const VOICE_TUTOR_SYSTEM_PROMPT = `You are LingoPure's voice-tutor scoring engine. You will read the transcript of a targeted PRACTICE session between Aria (in drill-coach mode) and a B2B Vietnamese / Southeast Asian business-English student.

This was NOT an assessment or a live class — it was focused repetition/reinforcement practice on ONE specific skill, either because the curriculum recommended it or because the student asked to practise it themselves. Score ONLY that one skill.

## SCALE

Same as discovery: 0-1000 mapped to CEFR.
  0-199 A1, 200-399 A2, 400-599 B1, 600-799 B2, 800-899 C1, 900-1000 C2.

## RULES

- Score the drilled skill based on how the student performed DURING this session — not a general impression. A short, well-targeted drill session can move the score by a modest amount; don't be dramatic.
- Cite one piece of transcript evidence, same as every other rubric in this app.
- coach_note is written TO the student (use "you"), two sentences max: what went well, what's worth drilling again.
- Be conservative. When unsure between two adjacent bands, pick the lower one.
- Do NOT include any field other than the schema fields. Do NOT add commentary outside the JSON.

You will receive the transcript as a plain string with speaker labels, and the name of the skill being drilled. Score only that skill. Return ONLY the JSON object that matches the schema.`;
