import type {
  CanonicalAssessmentResult,
  LP18WorkingState,
} from "@/lib/2k/contracts";
import {
  ARCHETYPE_FAMILY_MAP,
} from "@/lib/2k/engines/diagnostic-engine";
import {
  TRAJECTORY_MOMENTS,
  PRIOR_RESPONSE_MODIFIERS,
  type TrajectoryAssessment,
  type PriorResponseState,
} from "@/lib/2k/engines/hysteresis-engine";
import {
  bandForScore,
} from "@/lib/2k/engines/lp1000-engine";

/**
 * LingoPure 2K — Recommendation Control (C15, ISS-029)
 *
 * Turns the diagnosis (C14) into the CanonicalAssessmentResult.recommendation
 * record: the A–J action family, threat priority, exposure plan and the next
 * reassessment probe.  Everything traces to the seeded data banks:
 *
 *   - Family:  the archetype→issue-family map (bank seed), A for capability
 *              gap ... J for progression control (probe / do-not-train).
 *   - Severity: LP-1000 band severity multiplier (score_bands.json).
 *   - Urgency:  trajectory moment urgency multiplier (trajectory_moments.json).
 *   - Dose:     prior-response dose multiplier (prior_responses.json R1–R5).
 *   - Exposure: band exposure multiplier + canonical state focus.
 *   - Probe:    band reassessment observation count + trajectory action rule.
 *
 * `priority` is the normalised product of severity × urgency × dose on a 0–1
 * scale over the canonical multiplier envelope, so an identical state always
 * yields an identical priority.
 *
 * Engine version string: REC-CONTROL-v1.0.0
 */

export const RECOMMENDATION_ENGINE_VERSION = "REC-CONTROL-v1.0.0";

// Canonical multiplier envelope (min..max) for normalisation.
const SEVERITY_ENVELOPE = { min: 0.58, max: 1.3 };
const URGENCY_ENVELOPE = { min: 0.82, max: 1.35 };
const DOSE_ENVELOPE = { min: 0.78, max: 1.35 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalise(
  value: number,
  envelope: { min: number; max: number }
): number {
  return clamp(
    (value - envelope.min) / (envelope.max - envelope.min),
    0,
    1
  );
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Input ──────────────────────────────────────────────────────────────────

export interface RecommendationInput {
  diagnosis: CanonicalAssessmentResult["diagnosis"];
  lp1000: CanonicalAssessmentResult["lp1000"];
  working: LP18WorkingState;
  trajectory: TrajectoryAssessment;
  priorResponse?: PriorResponseState;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical recommendation record.
 *
 * Deterministic: the same diagnosis + band + moment + prior response always
 * produces the same family, priority, exposure and next probe.
 */
export function resolveRecommendation(
  input: RecommendationInput
): CanonicalAssessmentResult["recommendation"] {
  const { diagnosis, lp1000, working, trajectory, priorResponse } = input;

  // Family: from the archetype→issue-family map (A–J).
  const familyMapping =
    ARCHETYPE_FAMILY_MAP[diagnosis.archetype] ??
    ARCHETYPE_FAMILY_MAP["CAPABILITY"];
  const family = familyMapping.family;

  // Severity (band), urgency (moment), dose (prior response).
  const band = bandForScore(lp1000.score);
  const moment =
    TRAJECTORY_MOMENTS.find((m) => m.moment_id === trajectory.moment_id) ??
    TRAJECTORY_MOMENTS[4];
  const priorModifier =
    PRIOR_RESPONSE_MODIFIERS.find(
      (m) => m.prior_response === priorResponse
    ) ?? null;

  const severity = band.severity_multiplier;
  const urgency = moment.urgency_multiplier;
  const dose = priorModifier?.dose_multiplier ?? 1;

  // Priority: blend of severity, urgency and dose contributions, each scaled
  // within its canonical envelope, folded to 0–1.
  const priority = round3(
    (0.45 * normalise(severity, SEVERITY_ENVELOPE) +
      0.35 * normalise(urgency, URGENCY_ENVELOPE) +
      0.2 * normalise(dose, DOSE_ENVELOPE))
  );

  // Exposure: dose × band exposure multiplier, expressed as a canonical
  // session plan with the band's state focus.
  const exposureMultiplier = round3(clamp(dose * band.exposure_multiplier, 0.5, 1.5));
  const exposure =
    family === "J"
      ? `HOLD DOSE — ${familyMapping.name} | ${band.state_focus}`
      : `NEXT DOSE ${exposureMultiplier}× | ${band.state_focus}`;

  // Next probe: canonical reassessment probe from the band + trajectory rule.
  const probeTarget = working.micro_levels
    .filter((m) => m.evidence_count > 0)
    .sort((a, b) => b.level - a.level)[0] ?? null;
  const nextProbe =
    family === "J"
      ? `Novel-context probe at ${probeTarget?.level ?? 1}+ before any dose; ${moment.action_rule}`
      : `Novel-context transfer probe after ${band.reassess_observations} corroborated observations; ${moment.action_rule}`;

  // Deterministic intervention reference on the bank ID scheme
  // LPIR-{FAMILY}-{CAP}-{LEVEL}; the concrete bank row is chosen at lesson time.
  const primaryCapability = probeTarget?.capability ?? "ALL";
  const primaryLevel = probeTarget?.level ?? 1;
  const interventionId = `LPIR-${family}-${primaryCapability}-${primaryLevel}`;

  return {
    family,
    intervention_id: family === "J" ? undefined : interventionId,
    priority,
    exposure,
    next_probe: nextProbe,
  };
}