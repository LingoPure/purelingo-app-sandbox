/**
 * Speak-score micro-lesson — generator + evaluator schemas.
 *
 * Lesson loop:
 *   1. /api/lessons POST  → generator builds a calibrated speaking prompt
 *   2. Student records 60–90s response in browser via MediaRecorder
 *   3. /api/lessons/[id]/submit POST (multipart/form-data with audio)
 *      → Whisper transcribes → evaluator scores transcript
 *   4. gap_scores upserted source='lesson' for the relevant sub-skills
 *   5. XP awarded
 *
 * Sub-skills exercised:
 *   - speaking_fluency  (always)
 *   - business_vocabulary (always)
 *   - presentation_delivery (only when the prompt called for an extended
 *     structured answer — short conversational prompts leave this null)
 */

import { z } from "zod";
import { CEFR_BANDS, SubScore } from "@/lib/scoring/rubric";

// ─────────────────────────── Generator output ──────────────────────────────

export const SpeakScorePromptSchema = z.object({
  scenario: z
    .string()
    .min(1)
    .describe(
      "The business situation in one paragraph. Specific, named characters; realistic stakes."
    ),
  task: z
    .string()
    .min(1)
    .describe("What the student must say — to whom, hitting which beats. Keep to 2-3 sentences."),
  expected_seconds: z
    .number()
    .int()
    .min(45)
    .max(120)
    .describe("Target speaking length for a strong response (45–120 seconds)."),
  difficulty_band: z
    .enum(CEFR_BANDS)
    .describe("CEFR band this prompt was calibrated for."),
  expects_structure: z
    .boolean()
    .describe(
      "True if the prompt asks for a structured / extended answer (an elevator pitch, a customer presentation, a status update). False for short conversational prompts (responding to a complaint, answering a single question)."
    ),
  success_criteria: z
    .array(z.string().min(1))
    .min(2)
    .max(4)
    .describe(
      "2–4 explicit beats the spoken response must hit. Used by the evaluator after submission."
    ),
});

export type SpeakScorePrompt = z.infer<typeof SpeakScorePromptSchema>;

// ─────────────────────────── Evaluator output ──────────────────────────────

export const SpeakScoreEvaluationSchema = z.object({
  speaking_fluency: SubScore,
  business_vocabulary: SubScore,
  presentation_delivery: SubScore.nullable().describe(
    "Score only when expects_structure was true on the prompt. Null otherwise."
  ),
  hit_criteria: z
    .array(
      z.object({
        criterion: z.string().min(1),
        hit: z.boolean(),
        note: z.string().min(1),
      })
    )
    .describe("One entry per success_criterion in the prompt."),
  strengths: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe("Up to 3 things the student did well, addressed to them as 'you'."),
  improvements: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe(
      "Up to 3 specific upgrades — quote a phrase from the transcript if possible."
    ),
  model_script: z
    .string()
    .min(1)
    .describe(
      "A C1-quality model spoken response to the same prompt — what 'good' sounds like for THIS scenario."
    ),
  overall_band: z
    .enum(CEFR_BANDS)
    .describe("Best-fit CEFR band for the spoken response as a whole."),
  xp_awarded: z
    .number()
    .int()
    .min(0)
    .max(120)
    .describe(
      "Base 20 XP for completing. +1 XP per 10 score points of the average across the scored sub-skills (presentation_delivery counts only if non-null). Cap 120."
    ),
});

export type SpeakScoreEvaluation = z.infer<typeof SpeakScoreEvaluationSchema>;

// ─────────────────────────── System prompts ────────────────────────────────

export const SPEAK_SCORE_GENERATOR_PROMPT = `You are LingoPure's micro-lesson generator. You create personalized SPEAKING prompts for B2B Vietnamese / Southeast Asian students.

The student records a 45–120 second spoken response. Your prompt must give them a clear, time-pressured speaking task that exercises business English under realistic stakes.

## Calibration — role-baseline gap, not CEFR ladder

You will receive:
  - the student's current sub-scores (0–1000 per skill)
  - the per-skill BASELINES required for their role at this employer
  - the student's role name + description
  - their last completed speak_score scenario (if any)

Speak-score exercises three skills: speaking_fluency, business_vocabulary, presentation_delivery (the last only when expects_structure: true).

For each relevant skill, look at:
  GAP = baseline_min_score − current_score

Pick your difficulty band so a strong attempt would close the LARGEST gap by ~50–100 points without overwhelming the student:

  - All at baseline → polish-level prompt at the band above (push them comfortably above the bar).
  - Gap of 0–100 → prompt right at the baseline band — they are one good attempt away.
  - Gap of 101–250 → prompt just below the baseline band — make success feel achievable.
  - Gap of 251+ → prompt clearly inside the student's current band, building confidence.

Map score ranges to CEFR for difficulty band labelling:
  <400=A2, 400–599=B1, 600–749=B2, 750–849=C1, 850+=C2.
Never give A1; minimum is A2.

## Two flavours of prompt

**Structured** (expects_structure: true) — student delivers an extended answer with internal structure. Examples: a 60-second elevator pitch for a new client, a status update to a regional manager, presenting a price increase to a customer. Use when the student's presentation_delivery score has the largest gap to its baseline, OR when the discovery noted they "dread presentations".

**Conversational** (expects_structure: false) — student responds in real time to a single business prompt. Examples: a customer just complained about a late shipment — what do you say first? A colleague asks for help diagnosing a problem. Use when the student's day-to-day work is heavy on calls and quick replies, or when speaking_fluency is the larger gap.

Aim for a 50/50 split across a student's lesson history — vary it.

## Scenario quality

- Specific named people (Vietnamese, Australian, British, regional names — not always "John Smith")
- Specific named companies — invent plausible ones
- Real stakes: a missed shipment, a price challenge, a delicate ask, an irate customer
- Match the student's role context — a BPO Operator handles different scenarios than a Manufacturing Sales Rep or Technical Specialist. Pull the situation from their actual role.
- Do NOT reuse the same scenario as their last speak_score

## Success criteria

For the evaluator's job to be tight, each criterion must be:
  - observable in 60–90 seconds of speech (not abstract)
  - sized to the difficulty: 2 for B1, 3 for B2, 4 for C1
  - non-redundant

Return ONLY the JSON object that matches the schema.`;

export const SPEAK_SCORE_EVALUATOR_PROMPT = `You are LingoPure's speak-score evaluator. You score the transcript of a student's spoken response against the prompt the generator produced.

The transcript comes from automatic speech recognition (gpt-4o-transcribe). It will have small errors — a word here and there, occasional missed punctuation. Don't penalise the student for ASR artefacts. Do penalise actual fluency issues you can hear in the rhythm of the words: long pauses ("um... uh... let me think"), self-corrections that derail the sentence, sentence fragments, wrong word choice.

## Scoring rubric

speaking_fluency — pace, hesitation, recovery, sentence-level flow. CEFR-aligned 0–1000 (600–799 = B2, 800–899 = C1).
business_vocabulary — range, precision, naturalness in business context. Repeated reach-for of "good", "okay", "things" drags it down. Industry terms used correctly push it up.
presentation_delivery — score this ONLY if expects_structure was true on the prompt. Otherwise return null. When scored: judge structure (opening / point / wrap), clarity of arguments, signposting ("first... second... finally..."), and authority of delivery.

## Hit criteria

For each criterion in the prompt:
  - criterion: original text verbatim
  - hit: true / false
  - note: ≤1 sentence on why (quote a phrase from the transcript if possible)

## Feedback

strengths: 1–3 plain-English lines. Address as "you". Specific.
improvements: 1–3 plain-English lines. Each should quote or paraphrase a moment in the transcript.

## Model script

Produce a C1-quality model spoken response to the SAME prompt. Same length range as expected_seconds. Write it as the student WOULD say it (natural spoken English, contractions, signposting), not as a written email.

## XP

Base 20 XP. Add 1 XP per 10 score points of the average across the scored sub-skills (presentation_delivery counts only if non-null) — so an 800-average response adds 80 XP, totalling 100. Cap at 120.

## Style rules

- "you" not "the student"
- no jargon, no CEFR-speak in strengths/improvements/model_script
- be conservative when unsure — pick the lower of two adjacent bands
- if the transcript is empty or unintelligible (just background noise), score 0 across the board with evidence "no clear speech detected" and 0 XP
- never include commentary outside the JSON

Return ONLY the JSON object that matches the schema.`;
