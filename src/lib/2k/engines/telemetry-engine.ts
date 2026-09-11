import type {
  CommunicationAnalysisObject,
  CanonicalAssessmentResult,
} from "@/lib/2k/contracts";
import {
  TELEMETRY_12D,
  D6_TELEMETRY_BASE_WEIGHTS,
  type CanonicalTelemetryDimension,
} from "@/lib/2k/engines/communication-analysis";
import {
  ADDRESS_TO_CAPABILITY,
} from "@/lib/2k/engines/lp18-state-engine";

/**
 * LingoPure 2K — Telemetry Engine (C12, ISS-026)
 *
 * Aggregates the per-response 12D contextual telemetry into the
 * CanonicalAssessmentResult telemetry block.  Scores are seeded from the
 * canonical d6_base.json base weights so each capability's telemetry signature
 * biases the aggregate — the same distinction C10/C11 make between capability
 * state (what a learner can do) and runtime telemetry (how they produced it).
 *
 * Deterministic design:
 *   - Dimension score = confidence × base-weight weighted mean over every
 *     measured analysis entry for that dimension.
 *   - Drift = normalised spread of the telemetry signal across responses.
 *   - Convergence = how consistently the trailing readings agree; with a
 *     single analysis convergence cannot be shown and is reported 0.
 *
 * Engine version string: TEL-12D-v1.0.0
 */

export const TELEMETRY_ENGINE_VERSION = "TEL-12D-v1.0.0";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) /
    values.length;
  return Math.sqrt(variance);
}

// ─── Input ──────────────────────────────────────────────────────────────────

export interface TelemetryEngineInput {
  /** One CommunicationAnalysisObject per response in the assessment. */
  analyses: CommunicationAnalysisObject[];
}

// ─── Engine ─────────────────────────────────────────────────────────────────

/**
 * Resolve the CanonicalAssessmentResult.telemetry block from the response
 * analyses.  Deterministic, pure, data-bank seeded.
 */
export function resolveTelemetry(
  input: TelemetryEngineInput
): CanonicalAssessmentResult["telemetry"] {
  const { analyses } = input;

  // Per-analysis: which capabilities does the response exercise?
  // Map via its lp18_evidence capability addresses.
  const analysesWithCaps = analyses.map((analysis) => {
    const caps = new Set(
      analysis.lp18_evidence
        .map((entry) => ADDRESS_TO_CAPABILITY[entry.capability_address])
        .filter((cap): cap is NonNullable<typeof cap> => cap !== undefined)
    );
    return { analysis, caps };
  });

  // For each canonical dimension, aggregate score/confidence weighted by
  // the D6 base weights of the engaged capabilities and the entry confidence.
  const dimensions = TELEMETRY_12D.map((dimension: CanonicalTelemetryDimension) => {
    const readings: Array<{ score: number; weight: number }> = [];

    for (const { analysis, caps } of analysesWithCaps) {
      const entry = analysis.telemetry_evidence.find(
        (e) => e.dimension === dimension
      );
      if (!entry || entry.score === undefined) continue;

      // D6 base weight for this dimension given the engaged capabilities.
      const capWeights = Array.from(caps).map(
        (cap) => D6_TELEMETRY_BASE_WEIGHTS[cap][dimension]
      );
      const baseWeight =
        capWeights.length > 0
          ? capWeights.reduce((a, b) => a + b, 0) / capWeights.length
          : 1;

      readings.push({
        score: entry.score,
        weight: baseWeight * Math.max(0.05, entry.confidence),
      });
    }

    if (readings.length === 0) {
      return { name: dimension, score: 0, confidence: 0 };
    }

    const totalWeight = readings.reduce((sum, r) => sum + r.weight, 0);
    const score = round3(
      clamp(
        readings.reduce((sum, r) => sum + r.score * r.weight, 0) / totalWeight,
        0,
        1
      )
    );
    const confidence = round3(
      clamp(
        readings.reduce((sum, r) => sum + r.weight, 0) /
          Math.max(1, readings.length),
        0.05,
        1
      )
    );

    return { name: dimension, score, confidence };
  });

  // Drift: normalised spread of per-response telemetry means.
  const perResponseMeans = analyses.map((analysis) => {
    const scores = analysis.telemetry_evidence
      .filter((e) => e.score !== undefined)
      .map((e) => e.score as number);
    return scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  });
  const rawDrift = stdev(perResponseMeans);
  // On a 0–1 axis the max conceivable stdev is ~0.5; normalise against it.
  const drift = round3(clamp(rawDrift / 0.5, 0, 1));

  // Convergence: how consistently the trailing readings agree.
  // Requires at least two analyses; with one, convergence is unshowable → 0.
  const convergence =
    analyses.length >= 2 ? round3(clamp(1 - drift * 1.5, 0, 1)) : 0;

  return {
    dimensions,
    drift,
    convergence,
  };
}