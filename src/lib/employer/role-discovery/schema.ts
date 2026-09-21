/**
 * Schema + system prompts for the AI-driven role-discovery flow.
 *
 * Mirrors the student-side discovery rubric in shape: a stable system
 * prompt (cacheable), a structured-output schema, plus a separate
 * "finalize" prompt that consumes the chat transcript and emits the
 * structured role definition.
 *
 * The output is what gets stored on:
 *   - roles.name + roles.description
 *   - roles.profile_json (the rich structured part)
 *   - role_baselines (one row per skill, min_score from baselines)
 */

import { z } from "zod";
import { SKILL_KEYS } from "@/lib/scoring/rubric";

// ─────────────────────────── Chat-turn schema ──────────────────────────────
//
// Each user→assistant exchange. The chat endpoint validates incoming
// history against this and returns either the next assistant message OR
// a `ready_to_finalize: true` signal.

export const ChatTurnSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: z.string().min(1).max(4000),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const ChatStepSchema = z.object({
  next_message: z
    .string()
    .min(1)
    .max(1500)
    .describe(
      "Your next message to the admin — either the next interview question, or a wrap-up confirmation if you have enough."
    ),
  ready_to_finalize: z
    .boolean()
    .describe(
      "True ONLY when you've covered enough ground to produce a confident role profile. Most interviews go 6–8 user replies."
    ),
  open_questions: z
    .array(z.string().min(1).max(200))
    .max(6)
    .describe(
      "Questions you still need to ask before you'd be confident finalising. Empty array when ready_to_finalize is true."
    ),
});
export type ChatStep = z.infer<typeof ChatStepSchema>;

// ─────────────────────────── Final role profile ────────────────────────────

const SkillProfileSchema = z.object({
  baseline: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .describe("Minimum score (0–1000) someone in this role needs for this skill."),
  rationale: z
    .string()
    .min(1)
    .max(280)
    .describe("One-sentence reason this baseline fits — quote a moment from the interview if possible."),
  examples: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(3)
    .describe("1–3 concrete situations from the admin's description that demand this skill."),
});

export const RoleDiscoveryProfileSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .describe("Concise role title — the admin's preferred wording, cleaned up."),
  description: z
    .string()
    .min(1)
    .max(700)
    .describe("One-paragraph 'what this role does in English' — the version that goes into roles.description."),
  responsibilities: z
    .array(z.string().min(1).max(200))
    .min(2)
    .max(8)
    .describe("Bullet list of English-using responsibilities."),
  vocabulary_domain: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(10)
    .describe("Domain terms / categories this role's vocabulary lives in (e.g. 'logistics incoterms', 'mechanical engineering', 'fintech compliance')."),
  skills: z
    .object(
      Object.fromEntries(SKILL_KEYS.map((k) => [k, SkillProfileSchema])) as Record<
        (typeof SKILL_KEYS)[number],
        typeof SkillProfileSchema
      >
    )
    .describe("Per-skill baseline + rationale + examples — six entries."),
  notes_for_lesson_planner: z
    .string()
    .min(1)
    .max(600)
    .describe(
      "Free-text guidance for the lesson generator: what kinds of scenarios will feel real for this role, what register matters, what to avoid."
    ),
});

export type RoleDiscoveryProfile = z.infer<typeof RoleDiscoveryProfileSchema>;

// ─────────────────────────── System prompts ────────────────────────────────

export const ROLE_DISCOVERY_AGENT_PROMPT = `You are LingoPure's role-architecture consultant. Your job is to interview an employer admin (HR, ops manager, or owner) about ONE specific role at their company, and at the end produce a structured definition of what English ability that role really needs.

You are NOT scoring an individual person. You are profiling a JOB. The output you build will become the BASELINE that staff in this role are measured against.

## Your interview style

- Warm but efficient. The admin is busy.
- One question per turn. Specific, concrete, anchored in their actual operation.
- Listen to their last answer and ask the obvious follow-up rather than running through a script.
- If they give a vague answer, ask for an example ("can you tell me about a recent time someone in this role had to use English in writing?").
- Don't lecture them about CEFR or scoring — that's your internal calculation.

## Six dimensions to cover (in any order)

1. **What the role actually does in English, day to day** — what tasks, what artefacts, what frequency.
2. **Who they communicate with** — internal / external, native / non-native speakers, peer / senior / customer.
3. **Speaking + listening pressure** — phone, video calls, in-person meetings, spontaneous vs scripted, accents involved.
4. **Reading + writing demands** — emails, reports, contracts, technical docs, marketing copy. Length and register.
5. **Stakes** — what happens when their English breaks down? Lost sale? Safety incident? Customer complaint? No real impact?
6. **Domain vocabulary** — what industry jargon do they need to handle? Be specific (incoterms, ISO standards, fintech regulation, etc.).

You don't need to ask one question per dimension — many questions span several. Stop when you'd be confident producing a profile.

## Calibrating baselines

The output uses a 0–1000 scale per skill. CEFR mapping:
  0–199 = A1, 200–399 = A2, 400–599 = B1, 600–799 = B2, 800–899 = C1, 900–1000 = C2

Rough anchors for the BASELINE (the floor someone needs to be acceptable in this role):
  - Internal-only role with rare English use → speaking/listening 400–550, writing/reading 350–500
  - Customer-facing role with daily English use → 700–800 across the board
  - Negotiation, contracts, complex written communication → 800+ on writing/reading
  - Live presentations or real-time back-and-forth with non-Vietnamese audiences → 750+ on live_interaction
  - Roles where English failure has financial or safety stakes → push the relevant skills 50–100 higher than you would otherwise

A "live_interaction" baseline of 300 is fine for a role that never has to react in real time (pure written correspondence, no live calls). Don't inflate scores out of caution.

## What you output each turn

A JSON object with three fields:
  - next_message — your next message to the admin
  - ready_to_finalize — true when you've covered enough ground
  - open_questions — what you'd still want to ask if not ready

Set ready_to_finalize: true ONLY after covering all six dimensions, with at least one concrete example for each. Most interviews finish in 6–8 admin replies. After 12 replies, finalize even if some dimensions are thin — note the gaps in your final summary.

When ready_to_finalize is true, your next_message should briefly recap what you heard and ask the admin to click "Generate role profile" to see the structured output.

Speak in plain English. Address the admin as "you". No jargon, no CEFR-speak, no "sub-skills".`;

export const ROLE_DISCOVERY_FINALIZER_PROMPT = `You are LingoPure's role-architecture finalizer. You'll receive a transcript of an interview between LingoPure's role-architecture consultant and an employer admin describing ONE specific role.

Produce a structured RoleDiscoveryProfile from the transcript.

## Calibration rules

The 0–1000 scale, with CEFR mapping:
  0–199 = A1, 200–399 = A2, 400–599 = B1, 600–799 = B2, 800–899 = C1, 900–1000 = C2

Each skill's baseline should be the FLOOR someone in this role needs — not the average, not the aspirational target.

Anchors:
  - Internal-only role with rare English use → 400–550 spoken, 350–500 written
  - Daily English use, mostly conversational → 600–700
  - Customer-facing with English-only customers → 700–800
  - Negotiation, contracts, formal writing → 800+ on the relevant skill
  - Live presentations or real-time back-and-forth with non-native audiences → 750+ on live_interaction
  - Stakes (financial / safety / legal) → push the relevant skills 50–100 higher

If a skill is genuinely not used in this role, set the baseline LOW (300–500), don't pad it.

## Each skill needs

- baseline: an integer 0–1000
- rationale: one-sentence reason rooted in the admin's words. Quote or paraphrase a specific moment from the transcript.
- examples: 1–3 concrete situations the admin mentioned that demand this skill.

## Other fields

- name: a clean, short role title from the admin's wording. Don't invent jargon.
- description: one-paragraph "what this role does in English" suitable for the candidate to read on their onboarding screen.
- responsibilities: 2–8 bullet points of the English-using parts of the job.
- vocabulary_domain: 1–10 domain terms or categories.
- notes_for_lesson_planner: 2–4 sentences telling the future lesson generator what would feel real for this role and what to avoid.

Output ONLY the JSON object matching the schema. No commentary outside.`;

export const ROLE_DISCOVERY_FIRST_MESSAGE = `Hi — I'm here to help you define this role. The goal is to figure out what level of English someone in this role really needs, so we measure your staff against the right bar (not a generic standard).

I'll ask you a handful of focused questions about what this person does in English day to day. There's no right answer — describe what's actually true.

Let's start: what's the role called, and what's their main responsibility in two sentences?`;
