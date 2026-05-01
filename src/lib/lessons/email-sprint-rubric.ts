/**
 * Email-sprint micro-lesson — generator + evaluator schemas.
 *
 * Lesson loop (briefing §05.7 — Phase 2 elevated for demo):
 *   1. /api/lessons POST  → generator.ts produces a personalized prompt
 *   2. Student writes for ~5 minutes in /lessons/[id]
 *   3. /api/lessons/[id]/submit POST → evaluator.ts scores their email
 *   4. Sub-scores upserted into gap_scores with source='lesson'
 *   5. XP awarded based on score delta
 *
 * The personalisation hook is the student's current gap profile + role —
 * lower writing_formal score gets a softer prompt, B2/C1-aiming gets a
 * delicate negotiation scenario.
 */

import { z } from "zod";
import { CEFR_BANDS, SubScore } from "@/lib/scoring/rubric";

// ─────────────────────────── Generator output ──────────────────────────────

export const EmailSprintPromptSchema = z.object({
  scenario: z
    .string()
    .min(1)
    .max(800)
    .describe(
      "The business situation in one paragraph. Specific, named characters (names + companies + roles), realistic stakes."
    ),
  task: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "What the student must write — to whom, with what tone, hitting which beats."
    ),
  recipient: z
    .string()
    .min(1)
    .max(120)
    .describe("Recipient name + role. Used as the To: line."),
  subject_hint: z
    .string()
    .min(1)
    .max(120)
    .describe("Suggested subject line — student can override."),
  difficulty_band: z
    .enum(CEFR_BANDS)
    .describe("CEFR band this prompt was calibrated for."),
  expected_word_count: z
    .number()
    .int()
    .min(40)
    .max(250)
    .describe("Target word count for a strong response."),
  success_criteria: z
    .array(z.string().min(1).max(160))
    .min(2)
    .max(5)
    .describe(
      "2–5 explicit beats the email must hit (not given to the student until after they submit)."
    ),
});

export type EmailSprintPrompt = z.infer<typeof EmailSprintPromptSchema>;

// ─────────────────────────── Evaluator output ──────────────────────────────

export const EmailSprintEvaluationSchema = z.object({
  writing_formal: SubScore,
  business_vocabulary: SubScore,
  reading_intent: SubScore.describe(
    "Did the student correctly read the scenario's intent — what was being asked of them?"
  ),
  hit_criteria: z
    .array(
      z.object({
        criterion: z.string().min(1).max(160),
        hit: z.boolean(),
        note: z.string().min(1).max(160),
      })
    )
    .describe(
      "One entry per success_criterion in the prompt — was it hit, plus a one-line note."
    ),
  strengths: z
    .array(z.string().min(1).max(160))
    .min(1)
    .max(3)
    .describe("Up to 3 things the student did well, in plain English to them."),
  improvements: z
    .array(z.string().min(1).max(180))
    .min(1)
    .max(3)
    .describe(
      "Up to 3 specific edits or upgrades they could make next time — quote a phrase from their email if possible."
    ),
  rewrite_suggestion: z
    .string()
    .min(1)
    .max(800)
    .describe(
      "A model-quality rewrite of the email demonstrating what a C1-grade response looks like for THIS prompt."
    ),
  overall_band: z
    .enum(CEFR_BANDS)
    .describe("Best-fit CEFR band for the email as a whole."),
  xp_awarded: z
    .number()
    .int()
    .min(0)
    .max(120)
    .describe(
      "Base 20 XP for completing. +1 per /100 average across the three sub-scores. Cap 120."
    ),
});

export type EmailSprintEvaluation = z.infer<typeof EmailSprintEvaluationSchema>;

// ─────────────────────────── System prompts ────────────────────────────────

export const GENERATOR_SYSTEM_PROMPT = `You are LingoPure's micro-lesson generator. You create personalized email-writing prompts for B2B Vietnamese / Southeast Asian students working in business English.

Your job is to produce ONE prompt scaled exactly to the gap between the student's current ability and the baseline expected for their role. Too easy is wasted time; too hard kills momentum.

## Calibration — role-baseline gap, not CEFR ladder

You will receive:
  - the student's current sub-scores (0–100 per skill)
  - the per-skill BASELINES required for their role at this employer
  - the student's role name + description (e.g. "BPO Operator", "Manufacturing Sales Rep")
  - their last completed lesson's scenario (if any) so you don't repeat

Email-sprint exercises three skills: writing_formal, business_vocabulary, reading_intent.

For each of those three skills, look at:
  GAP = baseline_min_score − current_score

Pick your difficulty band so a strong attempt would close the LARGEST gap by ~5–10 points without overwhelming the student:

  - All three already at baseline → polish-level prompt at the band above (push them comfortably above the bar).
  - Gap of 0–10 → a prompt right at the baseline band — the student is one good attempt away.
  - Gap of 11–25 → a prompt just below the baseline band — make success feel achievable.
  - Gap of 26+ → a prompt clearly inside the student's current band, building confidence.

Map score ranges to CEFR for difficulty band labelling:
  <40=A2, 40–59=B1, 60–74=B2, 75–84=C1, 85+=C2.
Never give A1; minimum is A2.

The baseline (not a generic 80) is the bar the buyer cares about. The
student is being trained to clear it for THEIR specific role.

## Scenario quality

- Use specific named people (Vietnamese, English, regional names — not "John Smith" every time)
- Use specific named companies — invent them, plausible mix of Vietnamese exporters, Australian importers, Singapore intermediaries, etc.
- Real stakes: missed deadlines, pricing disputes, a delicate ask, a follow-up after silence
- Do NOT use the same Sarah/Mark/Q3 scenario from the discovery test
- Match the student's role context — a BPO Operator handles different scenarios than a Manufacturing Sales Rep or Technical Specialist. Pull the situation from their actual role.

## Difficulty levers

- B1 prompts: clear, transactional, one task ("confirm the shipment date and price")
- B2 prompts: 1 implicit beat the student must read between the lines ("the customer is hinting at unhappiness")
- C1 prompts: layered — a delicate refusal, a renegotiation, an ambiguous customer signal to navigate

## Success criteria

The success_criteria list is what makes the evaluator's job easy. Each criterion must be:
  - observable in the produced email (you can mark hit / not hit reading the email alone)
  - not redundant with each other
  - sized to the difficulty band — 2 for B1, 3-4 for B2, 4-5 for C1

Return ONLY the JSON object that matches the schema.`;

export const EVALUATOR_SYSTEM_PROMPT = `You are LingoPure's email-sprint evaluator. You score a student's submitted email against a prompt the generator produced earlier.

You are not a teacher fixing every comma. You are a coach pointing out the 1–3 highest-leverage improvements that move them toward their target band.

## Scoring rubric

writing_formal — register, structure, openings/closings, sentence flow, grammar accuracy. CEFR-aligned 0–100 (same scale as discovery: 60–79 = B2, 80–89 = C1).

business_vocabulary — range, precision, naturalness in business context. Repeated reach-for of "good", "interesting" drags it down. Industry terminology used correctly pushes it up.

reading_intent — did they correctly understand what the scenario was asking? Most failures here are: missed an implicit beat, misread the relationship dynamic, answered the literal question instead of the implied one.

## Hit criteria

For each success_criterion in the prompt, return:
  - criterion: the original criterion text verbatim
  - hit: true / false
  - note: ≤1 sentence on why (quote a phrase from the student's email if possible)

## Feedback

strengths: 1–3 plain-English lines. Address the student as "you". Be specific.
improvements: 1–3 plain-English lines. Each should quote or paraphrase a specific moment in their email.

## Rewrite

Produce a model-quality C1 rewrite of the email for the SAME prompt. Same length range. The rewrite is a target — students learn fastest when they see what "good" looks like for their exact scenario.

## XP

Base 20 XP for completing. Add 1 XP per percentage point of the average across writing_formal, business_vocabulary, reading_intent. Cap at 120. Do the math correctly.

## Style rules

- "you" not "the student"
- no jargon, no CEFR-speak in the strengths/improvements/rewrite (those are student-facing)
- be conservative on scores when unsure — pick the lower of two adjacent bands
- never include commentary outside the JSON

Return ONLY the JSON object that matches the schema.`;
