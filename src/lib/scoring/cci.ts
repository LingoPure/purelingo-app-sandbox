/**
 * LP-1000 — the "Communication Convergence Index" (CCI).
 *
 * This is deliberately NOT "the same 0-1000 number as a student's per-skill
 * gap_scores average, relabeled." Per LingoPure's own source documentation
 * it is a SEPARATE metric from the LP-18/CEFR placement in rubric.ts:
 *
 *   - LP-18 (rubric.ts scoreToLp18) answers "what CEFR micro-level is this
 *     person at" — a discrete classification, traceable to CEFR by
 *     construction (it subdivides CEFR bands into thirds).
 *   - LP-1000/CCI answers "how stable/converged is this person's ability
 *     across signals" — a continuous index that can differ between two
 *     people at the SAME CEFR level.
 *
 * Source: docs/LingoPure main documents/Tech/
 * LingoPure LP-1000 Technology & Defensibility Brief.pdf (p.10):
 *   "The index evaluates the convergence stability of five communication
 *    signals: Listening, Reading, Writing, Grammar, Spoken Interaction...
 *    CCI is not vocabulary. CCI measures convergence stability across the
 *    five signals. Two people with the same CEFR level can produce very
 *    different CCI scores depending on how balanced their communication
 *    signals are." The doc's own worked example: Person A (Listening C1,
 *    Speaking B2, Grammar B1 — uneven) scores CCI 620; Person B (Listening/
 *    Speaking/Grammar all B2 — even) scores CCI 710, "more balanced,
 *    producing stronger convergence" despite no single higher peak.
 *
 * Before this module, nothing in the live scoring path implemented LP-1000
 * as its own metric — the dashboard's "overall" number was just a flat
 * average of all canonical gap_scores (sometimes 8 dimensions, sometimes
 * 6), then run through the CEFR/LP-18 functions as if it WERE a CEFR
 * placement. That conflation is what produced the "720 reads B2 here and
 * C1.1 there" bug. See docs/audit/platform-state-2026-10-11.md §B.
 */
import type { SkillKey } from "@/lib/scoring/rubric";

/** Bump whenever the formula below changes — same discipline RUBRIC_VERSION
 *  applies to the CEFR/LP-18 mapping (threaded wherever this is persisted). */
export const CCI_FORMULA_VERSION = "1.0.0";

/**
 * Dan's documented 5 core signals for LP-1000. NOT the same 5 dimensions
 * the LP-18 Assessment & Placement Guide names (that list is Fluency &
 * Coherence / Vocabulary Range / Grammar & Structure / Pronunciation /
 * Interaction & Communication) — the two source documents use two
 * different 5-signal sets for two different purposes. This module follows
 * the Defensibility Brief's set because it's the one that's explicitly
 * for LP-1000.
 */
export const CCI_CORE_SIGNALS = [
  "listening",
  "reading",
  "writing",
  "grammar",
  "live_interaction",
] as const satisfies readonly SkillKey[];

export type CciSignalKey = (typeof CCI_CORE_SIGNALS)[number];

export type CciBand =
  | "Survival"
  | "Functional"
  | "Professional"
  | "Stable Professional"
  | "Executive Stability"
  | "Strategic Mastery";

/**
 * Source: the same Defensibility Brief (p.10) — "150 Basic survival
 * communication / 350 Functional workplace communication / 600 Reliable
 * professional communication / 800 Executive communication stability /
 * 950+ Near-native strategic communication." Boundaries also match
 * data-banks/score_bands.json, which already implemented this correctly —
 * it just lived only in the orphaned 2K engine, never consumed by the
 * live gap_scores/dashboard path this module now feeds.
 */
export const CCI_BANDS: readonly { band: CciBand; min: number; max: number }[] = [
  { band: "Survival", min: 0, max: 149 },
  { band: "Functional", min: 150, max: 349 },
  { band: "Professional", min: 350, max: 599 },
  { band: "Stable Professional", min: 600, max: 799 },
  { band: "Executive Stability", min: 800, max: 949 },
  { band: "Strategic Mastery", min: 950, max: 1000 },
];

export function cciToBand(score: number): CciBand {
  for (const b of CCI_BANDS) {
    if (score >= b.min && score <= b.max) return b.band;
  }
  return score < 0 ? "Survival" : "Strategic Mastery";
}

// ── The formula ────────────────────────────────────────────────────────
//
// IMPLEMENTATION NOTE (read before tuning): the source brief gives the
// CONCEPT and one illustrative worked example (two 3-signal profiles) —
// it does not publish exact coefficients. The constants below are a
// good-faith first implementation loosely sanity-checked against that one
// example; they are NOT a reverse-engineered exact fit to it (fitting a
// formula to two anecdotal numbers would be overclaiming precision that
// doesn't exist). Treat them as tunable once real multi-signal data exists
// to calibrate against — bump CCI_FORMULA_VERSION on any change.
const STABILITY_BONUS = 0.015; // small reward for having anything to converge
const STABILITY_PENALTY_WEIGHT = 0.5; // how hard spread pulls the score down
const STABILITY_MULTIPLIER_MIN = 0.85;
const STABILITY_MULTIPLIER_MAX = 1.05;

/**
 * Computes the CCI from whichever of the 5 core signals are currently
 * assessed (gap_scores rows may have nulls for unassessed skills).
 *
 * Deliberately NOT a plain average: a tightly-converged profile scores
 * slightly ABOVE its own mean; a spread-out one scores below it — the
 * "balance" behaviour the source doc describes. The adjustment is
 * intentionally small and bounded (±15%) so the number still tracks overall
 * ability as the primary driver — a student who genuinely improves should
 * see this number move up, not down, even if that improvement is uneven
 * across signals.
 *
 * Returns null when no core signal has been assessed yet (never 0 — a
 * missing measurement is not the same as a measured zero).
 */
export function computeCommunicationConvergenceIndex(
  signals: Partial<Record<CciSignalKey, number | null | undefined>>
): number | null {
  const values = CCI_CORE_SIGNALS.map((k) => signals[k]).filter(
    (v): v is number => v != null
  );

  if (values.length === 0) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Convergence is only meaningful across >=2 points.
  if (values.length === 1 || mean === 0) {
    return Math.round(Math.min(1000, Math.max(0, mean)));
  }

  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  const multiplier = Math.min(
    STABILITY_MULTIPLIER_MAX,
    Math.max(
      STABILITY_MULTIPLIER_MIN,
      1 + STABILITY_BONUS - STABILITY_PENALTY_WEIGHT * coefficientOfVariation
    )
  );

  return Math.round(Math.min(1000, Math.max(0, mean * multiplier)));
}
