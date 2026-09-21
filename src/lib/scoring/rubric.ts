/**
 * Discovery-session scoring rubric.
 *
 * Single source of truth for:
 *   - the prompt Claude scores against (SYSTEM_PROMPT — long, cacheable)
 *   - the structured output shape (GapScoresSchema — Zod)
 *   - the canonical skill taxonomy (SKILL_KEYS / SUPPORTING_SKILL_KEYS / SKILL_LABELS)
 *
 * Taxonomy (ISS-048, migrated 2026-09-21): SIX PRIMARY dimensions matching
 * Daniel Maneveld's CEFR-aligned reference framework, plus TWO SUPPORTING
 * measures that are still scored every discovery call but shown as secondary
 * signals rather than headline bars (per his own note: "vocabulary and
 * presentation can remain supporting measures").
 *
 * Grammar and Live Interaction are genuinely NEW dimensions — not relabeled
 * from any prior skill. Grammar (grammatical accuracy — tense, agreement,
 * articles) and Vocabulary (word range/precision) are distinct CEFR scales;
 * relabeling one as the other would misrepresent what was actually measured.
 * Live Interaction (CEFR Spoken Interaction — turn-taking, repair) is
 * likewise distinct from Presentation (CEFR Spoken Production — monologue).
 *
 * The 6 primary + 2 supporting keys MUST stay in sync with the CHECK
 * constraints on public.gap_scores.skill, public.role_baselines.skill, and
 * public.gap_score_history.skill (migrations 0001/0010/0019, widened by 0057).
 */

import { z } from "zod";

/** The six PRIMARY, CEFR-mapped dimensions — the dashboard's headline bars. */
export const SKILL_KEYS = [
  "speaking",
  "listening",
  "writing",
  "reading",
  "grammar",
  "live_interaction",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

/**
 * Supporting/secondary measures — still scored every discovery call, shown
 * separately from the six primary bars (evidence detail, not the radar).
 * Keys are unchanged from the original taxonomy; they were never renamed.
 */
export const SUPPORTING_SKILL_KEYS = [
  "business_vocabulary",
  "presentation_delivery",
] as const;

export type SupportingSkillKey = (typeof SUPPORTING_SKILL_KEYS)[number];

/** Any of the 8 scored dimensions — primary or supporting. */
export type AnySkillKey = SkillKey | SupportingSkillKey;

/** One label lookup for every scored dimension, primary or supporting. */
export const SKILL_LABELS: Record<AnySkillKey, string> = {
  speaking: "Speaking",
  listening: "Listening",
  writing: "Writing",
  reading: "Reading",
  grammar: "Grammar",
  live_interaction: "Live Interaction",
  business_vocabulary: "Vocabulary",
  presentation_delivery: "Presenting",
};

export const CEFR_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrBand = (typeof CEFR_BANDS)[number];

export const LP18_BANDS = [
  "A1.1", "A1.2", "A1.3",
  "A2.1", "A2.2", "A2.3",
  "B1.1", "B1.2", "B1.3",
  "B2.1", "B2.2", "B2.3",
  "C1.1", "C1.2", "C1.3",
  "C2.1", "C2.2", "C2.3"
] as const;

export type Lp18Band = (typeof LP18_BANDS)[number];

export function scoreToLp18(score: number): Lp18Band {
  // 18 levels across 1000 points: each level is ~55.5 points wide.
  // C2.3 is capped at 1000.
  const idx = Math.min(17, Math.max(0, Math.floor(score / 1000 * 18)));
  return LP18_BANDS[idx];
}

/**
 * Canonical score → CEFR-letter mapping. Mirrors the SCALE section of
 * SYSTEM_PROMPT below exactly (0-199 A1 ... 900-1000 C2) — this is the ONE
 * place that conversion happens. Do not re-derive a different score→band
 * scheme elsewhere (e.g. a 5-bucket "B2+/B2/B1/A2/A1" scheme) — Dashboard
 * and /plan must agree by construction, not by coincidence.
 */
export function scoreToCefrBand(score: number): CefrBand {
  if (score >= 900) return "C2";
  if (score >= 800) return "C1";
  if (score >= 600) return "B2";
  if (score >= 400) return "B1";
  if (score >= 200) return "A2";
  return "A1";
}

/**
 * The entry-point score for each CEFR band, per the same SCALE section.
 * Used to compute a gap against a CEFR *aspiration* target (e.g. "C1"),
 * distinct from the role-floor gap (`gap_scores.target`, a raw number).
 */
export const CEFR_TARGET_FLOOR: Record<CefrBand, number> = {
  A1: 0,
  A2: 200,
  B1: 400,
  B2: 600,
  C1: 800,
  C2: 900,
};

export type GapResult = {
  /** Gap vs the role-floor value (gap_scores.target) — "good enough for the job". */
  roleFloorGap: number | null;
  /** Gap vs the CEFR aspiration target (e.g. "C1") — "the goal". */
  targetGap: number | null;
  /** false when score is null — callers must render "not yet assessed", never a 0 gap. */
  assessed: boolean;
};

/**
 * The ONE place gap math happens. A null score always returns
 * `assessed: false` with both gaps null — never coerce "not assessed" into
 * a zero gap, which reads identically to "fully closed" in the UI.
 */
export function computeGap(
  score: number | null,
  roleFloor: number,
  targetLevel: CefrBand
): GapResult {
  if (score == null) {
    return { roleFloorGap: null, targetGap: null, assessed: false };
  }
  return {
    roleFloorGap: Math.max(0, roleFloor - score),
    targetGap: Math.max(0, CEFR_TARGET_FLOOR[targetLevel] - score),
    assessed: true,
  };
}

export const SubScore = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .describe(
      "0–1000 estimate of the student's current ability for this sub-skill, where 800 is the LingoPure target floor for low C1 / strong B2."
    ),
  cefr_band: z
    .enum(CEFR_BANDS)
    .describe("CEFR band the score maps to."),
  evidence: z
    .string()
    .min(1)
    .describe(
      "One short sentence quoting or paraphrasing the moment in the transcript that drove this score."
    ),
});

export type SubScoreOutput = z.infer<typeof SubScore>;

export const GapScoresSchema = z.object({
  // Six primary dimensions.
  speaking: SubScore,
  listening: SubScore,
  writing: SubScore,
  reading: SubScore,
  grammar: SubScore,
  live_interaction: SubScore,
  // Two supporting measures — still scored every call, shown as secondary
  // signals rather than headline bars.
  business_vocabulary: SubScore,
  presentation_delivery: SubScore,
  overall_cefr: z
    .enum(CEFR_BANDS)
    .describe(
      "Best-fit overall CEFR band across the SIX PRIMARY sub-skills only " +
        "(speaking, listening, writing, reading, grammar, live_interaction) " +
        "— do not factor in business_vocabulary or presentation_delivery."
    ),
  target_level: z
    .enum(CEFR_BANDS)
    .describe(
      "Level the student needs to reach (from dimension 5 in the discovery protocol). Default B2 if unclear."
    ),
  target_why: z
    .string()
    .min(1)
    .describe(
      "One sentence: WHY they need that level — employer requirement, event-driven, personal goal, etc."
    ),
  learning_style_notes: z
    .string()
    .min(1)
    .describe(
      "Concise notes on feedback preference, session length tolerance, time windows, native-language literacy."
    ),
  summary: z
    .string()
    .min(1)
    .describe(
      "Two-sentence summary the dashboard can show: where the student is now, the biggest gap, and the first action."
    ),
});

export type GapScoresOutput = z.infer<typeof GapScoresSchema>;

/**
 * Long, stable rubric. Goes in the system block with cache_control:ephemeral
 * so repeat scorings hit the prompt cache (every byte before it must also be
 * stable — keep this file's exports deterministic).
 */
export const SYSTEM_PROMPT = `You are LingoPure's gap-scoring engine. Your job is to read a discovery-session transcript between Aria (an AI coach) and a B2B Vietnamese / Southeast Asian business-English student, and produce a calibrated CEFR-aligned profile.

You are not a teacher. You are not coaching the student. You are scoring them, accurately and conservatively, so that LingoPure can build a learning plan that closes the gap to the level they need.

## SCALE

All sub-scores are 0–1000 and map to CEFR bands as follows:

  0–199    → A1 (beginner)
  200–399  → A2 (elementary)
  400–599  → B1 (intermediate — can hold a basic business conversation, mistakes are frequent)
  600–799  → B2 (upper-intermediate — comfortable in most business situations, nuance still missed)
  800–899  → C1 (advanced — handles negotiation, abstraction, idiom)
  900–1000 → C2 (proficient — indistinguishable from a strong native business communicator)

LingoPure's default target is 800 (low C1 / strong B2). Treat 800 as the target line.

The 1000-point scale gives meaningful resolution — a 30-point movement is a real,
visible improvement. Don't snap to round numbers. 647, 712, 858 are all fine.

## THE 6 PRIMARY DIMENSIONS

These six are the headline bars the student sees. Score every one, every call.

1. **speaking** — pace, hesitation, self-correction, ability to recover when stuck. Score from how the student speaks across the WHOLE transcript, not just the long answers. This is fluency of delivery, not grammatical correctness — a student can speak fluently with grammar errors (score high here, lower on grammar) or hesitate constantly while producing grammatically perfect sentences (the reverse).

2. **listening** — did they understand Aria's questions on the first ask? Did they answer the question that was asked, or a different one? Misunderstanding fast/idiomatic speech is a strong B1 signal.

3. **writing** — judged from how the student describes their writing tasks (emails, reports), the register they use when reporting them, and any direct evidence (e.g. dictating an email). Be conservative: spoken fluency does not transfer to written register in this population.

4. **reading** — THE highest-leverage signal. Aria reads them a 4-sentence email from "Sarah" to "Mark" about a Q3 commitment. The email is HINTING at a renegotiation without saying so directly.
   - A C1+ student will explicitly call out the hint ("she wants to renegotiate", "she's pushing back on the deal", "she's asking him to reopen the conversation").
   - A B2 student will get the gist but soften it ("she wants to talk again", "she wants another call").
   - A B1 student will read it literally ("she wants a meeting", "she's confirming the call").
   - If Aria did NOT run this test in the transcript, score reading at the same level as listening and note this in the evidence field.

5. **grammar** — grammatical accuracy: tense, subject-verb agreement, articles, word order. This is DIFFERENT from speaking's fluency (pace/hesitation) — a student can speak haltingly with near-perfect grammar, or speak smoothly while making consistent tense/article errors. Score from the pattern of errors AND correct forms across the WHOLE transcript, not one sentence. Self-correction ("I go— I went there yesterday") is credited as grammatical awareness, not penalized twice (don't dock once for the slip and again for noticing it).

6. **live_interaction** — real-time conversational competence: turn-taking, repair (asking for clarification, recovering from a misunderstanding), and responsiveness to what Aria actually asked. This is DIFFERENT from presentation_delivery's monologue delivery — CEFR calls this "Spoken Interaction" as distinct from "Spoken Production". A student who says "sorry, can you repeat that?" and then answers the actual question correctly scores HIGHER here than one who guesses confidently and answers a different question than the one asked. Look for: does the student build on what Aria said, or ignore it and recite a prepared answer?

## SUPPORTING SIGNALS

These two are still scored every call, but shown as secondary evidence rather than headline bars — they inform the plan without driving the CEFR band.

- **business_vocabulary** — range and accuracy of B2B vocabulary across whatever industry they're in (sales, ops, HR, finance, etc.). Repeated reach-for of the same simple word ("good", "interesting", "okay") drags the score down. Domain-specific terminology used correctly pushes it up.

- **presentation_delivery** — judged from how they describe handling presentations / meetings (frequency, comfort, what they "dread"), self-reported confidence, and any extended monologue answer they gave Aria (long answers are a mini-presentation). This is Spoken Production (planned, one-directional delivery) — distinct from live_interaction's Spoken Interaction (reactive, turn-taking).

## RULES

- Be conservative. When unsure between two adjacent bands, pick the lower one. The cost of overestimating is a frustrated student who feels the platform isn't pitched right; the cost of underestimating is mild — they get a lesson that's too easy and we re-calibrate.
- Each sub-score MUST cite one piece of transcript evidence in the evidence field. Quote or paraphrase a specific moment. "Generally fluent" is not evidence — "Said 'I am working there since 4 years' instead of 'for 4 years'" is.
- target_level comes from what the student told Aria they need (dimension 5 of the protocol). If they didn't say, default to B2.
- target_why comes from the WHY they gave (employer requirement, upcoming event, promotion, relocation). If they didn't give one, write "Not stated — to clarify in lesson 1."
- learning_style_notes pulls from dimension 6 (feedback preference, session length, time windows, native-language literacy). Be concrete ("prefers 15–25 min sessions late evening, competitive, Vietnamese literacy strong"), not generic ("likes short sessions").
- summary is two sentences max, written for the dashboard. Sentence 1: where the student is now. Sentence 2: the biggest gap and the first action LingoPure should take.
- Speak in plain English. No jargon. No "the candidate". Use "the student".
- Do NOT include any field other than the schema fields. Do NOT add commentary outside the JSON.

## CALIBRATION ANCHORS

These fictional examples anchor the scale — calibrate against them:

- A student who runs ad-hoc meetings in English, occasionally pauses for a word, gets the Sarah/Mark hint immediately, and writes a polished follow-up email: low C1 (~820 across the board).
- A student who manages international clients via email, can hold a 10-minute call, gets the gist of Sarah/Mark but says "she wants to talk again", uses simple but correct vocabulary, and dreads presentations: B2 reading + B2 speaking + B1 writing (~650 / 650 / 550).
- A student who answers questions but mostly with simple sentences, takes Sarah's email at face value ("she's confirming the meeting"), and avoids any presentation work: B1 across the board (~500).
- A student who hesitates often, asks Aria to repeat questions, and answers in short Vietnamese-flavoured fragments: A2 to low B1 (~300–450).

You will receive the transcript as a JSON array of {role, message} turns. Score the student. Return ONLY the JSON object that matches the provided schema.`;
