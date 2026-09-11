import type {
  CanonicalAssessmentResult,
  LP18WorkingState,
  LP18StableState,
  Lp1000Band,
} from "@/lib/2k/contracts";

/**
 * LingoPure 2K — LP-1000 Realization engine (C13, ISS-027)
 *
 * Realises the certified LP-18 stable state into the 0–1000 score scale,
 * indexed by the six canonical score bands (score_bands.json).  The LP-1000
 * is a *score over the realisation*, not a measurement of the learner: it is
 * the same capability state expressed on an executive 0–1000 axis so a
 * distributor/employer can gate hiring or placement decisions.
 *
 * Deterministic design:
 *   - Score = confidence-and-coverage weighted mean of each capability's
 *     certified 1–18 level mapped onto 0–1000.
 *   - Band = the canonical band whose SCORE_MIN..SCORE_MAX contains the score.
 *   - Components = per-capability 0–1000 sub-scores (the realisation base).
 *   - Confidence = stable-state confidence adjusted by telemetry convergence
 *     and hysteresis qualification.
 *
 * Engine version string: LP1000-R-v1.0.0
 */

export const LP1000_ENGINE_VERSION = "LP1000-R-v1.0.0";

export interface ScoreBand {
  band_id: string;
  band: Lp1000Band;
  score_min: number;
  score_max: number;
  severity_multiplier: number;
  recommendation_mode: string;
  state_focus: string;
  target_telemetry_delta: number;
  exposure_multiplier: number;
  reassess_observations: number;
}

/** Canonical six score bands (from score_bands.json). */
export const SCORE_BANDS: ScoreBand[] = [
  {
    band_id: "SB1",
    band: "Survival",
    score_min: 0,
    score_max: 149,
    severity_multiplier: 1.3,
    recommendation_mode: "RECOVERY_FIRST",
    state_focus:
      "Reduce complexity; stabilize the highest-impact bottleneck before adding progression pressure.",
    target_telemetry_delta: 0.06,
    exposure_multiplier: 1.3,
    reassess_observations: 2,
  },
  {
    band_id: "SB2",
    band: "Functional",
    score_min: 150,
    score_max: 349,
    severity_multiplier: 1.18,
    recommendation_mode: "FOUNDATION_BUILD",
    state_focus:
      "Build reliable core behaviour with controlled practice and short transfer checks.",
    target_telemetry_delta: 0.08,
    exposure_multiplier: 1.18,
    reassess_observations: 3,
  },
  {
    band_id: "SB3",
    band: "Professional",
    score_min: 350,
    score_max: 599,
    severity_multiplier: 1,
    recommendation_mode: "TARGETED_DEVELOP",
    state_focus:
      "Target the diagnosed issue while preserving broader professional communication demands.",
    target_telemetry_delta: 0.1,
    exposure_multiplier: 1,
    reassess_observations: 4,
  },
  {
    band_id: "SB4",
    band: "Stable Professional",
    score_min: 600,
    score_max: 799,
    severity_multiplier: 0.86,
    recommendation_mode: "TRANSFER_STABILIZE",
    state_focus:
      "Prioritize transfer, adaptive control, and consistency rather than broad remediation.",
    target_telemetry_delta: 0.11,
    exposure_multiplier: 0.9,
    reassess_observations: 4,
  },
  {
    band_id: "SB5",
    band: "Executive Stability",
    score_min: 800,
    score_max: 949,
    severity_multiplier: 0.72,
    recommendation_mode: "PRECISION_ADAPT",
    state_focus:
      "Use precision, hierarchy, ambiguity, strategic repair, and executive-context transfer.",
    target_telemetry_delta: 0.09,
    exposure_multiplier: 0.82,
    reassess_observations: 5,
  },
  {
    band_id: "SB6",
    band: "Strategic Mastery",
    score_min: 950,
    score_max: 1000,
    severity_multiplier: 0.58,
    recommendation_mode: "MAINTAIN_STRESS_TEST",
    state_focus:
      "Do not overtrain. Maintain through rare high-information stress/transfer probes.",
    target_telemetry_delta: 0.05,
    exposure_multiplier: 0.68,
    reassess_observations: 6,
  },
];

/** 1000-scale projection of a 1–18 LP-18 level. */
export function lp1000OfLevel(level: number): number {
  const clamped = Math.max(1, Math.min(18, level));
  return Math.round(((clamped - 1) / 17) * 1000);
}

export function bandForScore(score: number): ScoreBand {
  return (
    SCORE_BANDS.find((band) => score >= band.score_min && score <= band.score_max) ??
    SCORE_BANDS[0]
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Input ──────────────────────────────────────────────────────────────────

export interface Lp1000Input {
  working: LP18WorkingState;
  stable: LP18StableState;
  telemetry: CanonicalAssessmentResult["telemetry"];
}

// ─── Engine ─────────────────────────────────────────────────────────────────

/**
 * Resolve the lp1000 block from the certified stable state + telemetry.
 */
export function resolveLp1000(input: Lp1000Input): CanonicalAssessmentResult["lp1000"] {
  const { working, stable, telemetry } = input;

  // Per-capability realisation sub-scores (0–1000), weighted by the
  // working-state confidence and coverage of the certified level.
  const components: Record<string, number> = {};
  let totalScore = 0;
  let totalWeight = 0;

  for (const item of stable.micro_levels) {
    const workingEntry =
      working.micro_levels.find((m) => m.capability === item.capability) ?? null;
    const coverage = workingEntry?.coverage ?? 0;
    const confidence = workingEntry?.confidence ?? 0;

    const component = lp1000OfLevel(item.level);
    components[item.capability] = component;

    const weight = clamp(
      (item.level >= 2 ? 1 : 0) * Math.max(0.05, confidence) * Math.max(0.1, coverage),
      0.05,
      1
    );
    totalScore += component * weight;
    totalWeight += weight;
  }

  const baseScore =
    totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

  // Telemetry modulation: drift lowers trust in the realisation, healthy
  // convergence raises it.  Bounded so the score stays inside 0–1000.
  const stabilityDelta = Math.round(
    (telemetry.convergence - telemetry.drift) * 25
  );
  const score = Math.round(
    clamp(baseScore + stabilityDelta, 0, 1000)
  );

  const band = bandForScore(score).band;

  // Confidence: certified-state confidence × telemetry trust.
  // Hysteresis qualification (corroboration passed) is the dominant term;
  // without it the realisation is only nominal.
  const certifiedConfidence = stable.hysteresis_qualified ? 0.6 : 0.25;
  const telemetryTrust = round3(clamp(0.5 + telemetry.convergence - telemetry.drift, 0.05, 1));
  const confidence = round3(
    clamp(certifiedConfidence * telemetryTrust, 0, 1)
  );

  return {
    score,
    band,
    confidence,
    components,
  };
}