import type {
  LP18WorkingState,
  LP18StableState,
} from "@/lib/2k/contracts";
import {
  microLevelAt,
  cefrMacroOf,
  type MicroLevel,
} from "@/lib/2k/engines/lp18-state-engine";

/**
 * LingoPure 2K — LP-18 Hysteresis / State Transition engine (C11, ISS-025)
 *
 * Turns the working state (C10) into a certified stable state under
 * hysteresis rules seeded from trajectory_moments.json and prior_responses.json.
 *
 * The three canonical guards encoded here:
 *   - No automatic demotion.  Drift risk (working < stable) triggers
 *     diagnosis, not demotion; only explicit regression evidence certifies a
 *     downward transition.
 *   - No up-shift without corroboration.  A level is only certified when the
 *     acknowledgment evidence is corroborated (coverage gate) and the
 *     aggregate confidence clears the certification threshold.
 *   - No re-certification churn.  A certified level is never silently re-set
 *     to the same transition; transition_count only increments on real moves.
 *
 * Engine version string: HYST-STATE-v1.0.0
 */

export const HYSTERESIS_ENGINE_VERSION = "HYST-STATE-v1.0.0";

// ─── Canonical hysteresis parameters (from trajectory_moments.json) ─────────

export const TRAJECTORY_MOMENTS = [
  {
    moment_id: "M1",
    state: "RAPID_ADAPTATION",
    urgency_multiplier: 0.82,
    action_mode: "UPSCALE_EARLY",
    action_rule:
      "Improving faster than expected; validate in a novel context and pull the next bottleneck forward.",
    guardrail: "Do not keep drilling a solved issue.",
  },
  {
    moment_id: "M2",
    state: "RISING_CONVERGENCE",
    urgency_multiplier: 0.9,
    action_mode: "CONTINUE_THEN_TRANSFER",
    action_rule:
      "Continue current mechanism; reduce scaffolding and increase context variability.",
    guardrail: "Require independent transfer before progression.",
  },
  {
    moment_id: "M3",
    state: "STABLE_PROFESSIONAL",
    urgency_multiplier: 1,
    action_mode: "MAINTAIN_TARGET",
    action_rule:
      "Maintain the targeted plan until the success threshold is stable across repeated evidence.",
    guardrail: "Do not increase dose just because the score is unchanged.",
  },
  {
    moment_id: "M4",
    state: "DRIFT_RISK",
    urgency_multiplier: 1.18,
    action_mode: "DIAGNOSE_DRIFT",
    action_rule:
      "Bring reassessment forward; separate temporary drift from retained capability and inspect context/load.",
    guardrail: "Avoid automatic LP-18 demotion.",
  },
  {
    moment_id: "M5",
    state: "COMMUNICATION_BREAKDOWN",
    urgency_multiplier: 1.35,
    action_mode: "RECOVERY_REPAIR",
    action_rule:
      "Suspend progression pressure; prioritize repair, semantic recovery, load reduction, and evidence quality.",
    guardrail: "Do not stack multiple high-load interventions.",
  },
  {
    moment_id: "M6",
    state: "REGRESSION",
    urgency_multiplier: 1.3,
    action_mode: "REOPEN_DIAGNOSIS",
    action_rule:
      "Compare against prior stable T-state; test retention, context, automaticity, and unresolved prerequisites.",
    guardrail: "Require independent transfer before progression.",
  },
] as const;

export type TrajectoryMomentState = (typeof TRAJECTORY_MOMENTS)[number]["state"];

// ─── Canonical prior-response modifiers (from prior_responses.json) ─────────

export const PRIOR_RESPONSE_MODIFIERS = [
  {
    response_id: "R1",
    prior_response: "FAST",
    dose_multiplier: 0.78,
    action_mode: "ADVANCE_OR_TRANSFER",
    rule: "Close early if stable in a novel task; move to next unresolved priority.",
  },
  {
    response_id: "R2",
    prior_response: "EXPECTED",
    dose_multiplier: 1,
    action_mode: "CONTINUE",
    rule: "Continue planned dose and reassess at the normal trigger.",
  },
  {
    response_id: "R3",
    prior_response: "SLOW",
    dose_multiplier: 1.18,
    action_mode: "ADAPT_PLAN",
    rule: "Inspect dose, prerequisite, automaticity, context, receiver, channel, and task load; reroute if needed.",
  },
  {
    response_id: "R4",
    prior_response: "STALLED",
    dose_multiplier: 1.3,
    action_mode: "REOPEN_HYPOTHESIS",
    rule: "Do not add more of the same. Re-test issue family and upstream blockers.",
  },
  {
    response_id: "R5",
    prior_response: "REGRESSING",
    dose_multiplier: 1.35,
    action_mode: "RECOVERY_FIRST",
    rule: "Separate temporary runtime drift from durable loss; return to last stable state before progression.",
  },
] as const;

export type PriorResponseState = (typeof PRIOR_RESPONSE_MODIFIERS)[number]["prior_response"];

// ─── Hysteresis parameters ──────────────────────────────────────────────────

export interface HysteresisParams {
  /** Aggregate confidence required to certify an up-shift (0–1). */
  certificationConfidence: number;
  /** Coverage required to corroborate an up-shift (0–1). */
  corroborationCoverage: number;
  /** Level delta above stable that counts as RAPID_ADAPTATION. */
  rapidAdaptationDelta: number;
  /** Level delta below stable that counts as REGRESSION. */
  regressionDelta: number;
}

export const DEFAULT_HYSTERESIS_PARAMS: HysteresisParams = {
  certificationConfidence: 0.6,
  corroborationCoverage: 1,
  rapidAdaptationDelta: 2,
  regressionDelta: -1,
};

// ─── Input ──────────────────────────────────────────────────────────────────

export interface HysteresisInput {
  working: LP18WorkingState;
  priorStable?: LP18StableState | null;
  /** Latest prior-response modifier from the last applied intervention. */
  priorResponse?: PriorResponseState;
  params?: Partial<HysteresisParams>;
  certifiedAt?: string;
}

export interface TrajectoryAssessment {
  moment_id: string;
  state: TrajectoryMomentState;
  urgency_multiplier: number;
  action_mode: string;
  action_rule: string;
  guardrail: string;
}

// ─── Trajectory moment classification ───────────────────────────────────────

function capabilityDelta(
  working: LP18WorkingState,
  stable: LP18StableState,
  capability: string
): number {
  const workingEntry = working.micro_levels.find(
    (m) => m.capability === capability
  ) ?? null;
  const stableEntry = stable.micro_levels.find(
    (m) => m.capability === capability
  ) ?? null;
  if (!workingEntry) return stableEntry ? -1 : 0;
  if (!stableEntry) return 0;
  return workingEntry.level - stableEntry.level;
}

/**
 * Classify the trajectory moment from working vs stable state.
 * Mirrors trajectory_moments.json M1–M6.
 */
export function trajectoryMomentOf(
  working: LP18WorkingState,
  priorStable: LP18StableState | null | undefined,
  params: Partial<HysteresisParams> = {}
): TrajectoryAssessment {
  const p = { ...DEFAULT_HYSTERESIS_PARAMS, ...params };
  const moments = TRAJECTORY_MOMENTS;

  const evidencedLevels = working.micro_levels.filter(
    (m) => m.evidence_count > 0
  );
  const weakestConfidence =
    evidencedLevels.length > 0
      ? Math.min(...evidencedLevels.map((m) => m.confidence))
      : 0;

  const breakdownLike =
    working.overall_coverage < 0.34 || (weakestConfidence > 0 && weakestConfidence < 0.35);

  const deltas = priorStable
    ? working.micro_levels
        .filter((m) => m.evidence_count > 0)
        .map((m) => capabilityDelta(working, priorStable, m.capability))
    : [];

  if (working.overall_coverage === 0) {
    return { ...moments[4] }; // M5 COMMUNICATION_BREAKDOWN — no usable evidence
  }

  if (deltas.length === 0) {
    return { ...moments[1] }; // M2 RISING_CONVERGENCE — no prior anchor, building
  }

  const avgDelta =
    deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const maxDelta = Math.max(...deltas);
  const minDelta = Math.min(...deltas);

  if (maxDelta >= p.rapidAdaptationDelta) {
    return { ...moments[0] }; // M1 RAPID_ADAPTATION
  }
  if (minDelta <= p.regressionDelta) {
    return { ...moments[5] }; // M6 REGRESSION
  }
  if (breakdownLike) {
    return { ...moments[4] }; // M5 COMMUNICATION_BREAKDOWN
  }
  if (avgDelta > 0) {
    return { ...moments[1] }; // M2 RISING_CONVERGENCE
  }
  if (avgDelta < 0) {
    return { ...moments[3] }; // M4 DRIFT_RISK
  }
  return { ...moments[2] }; // M3 STABLE_PROFESSIONAL
}

// ─── Stable state resolution ────────────────────────────────────────────────

interface CapabilityCertification {
  level: number;
  capability: string;
  certified_level: MicroLevel;
  certified_at: string;
  transition_count: number;
}

function resolveCapability(
  working: LP18WorkingState,
  priorStable: LP18StableState | null | undefined,
  entry: LP18WorkingState["micro_levels"][number],
  params: HysteresisParams,
  now: string,
  priorResponse?: PriorResponseState
): CapabilityCertification {
  const priorEntry =
    priorStable?.micro_levels.find((m) => m.capability === entry.capability) ??
    null;

  const baseLevel = entry.evidence_count > 0 ? entry.level : 1;
  const priorLevel = priorEntry?.level ?? 1;

  const upshiftAllowed =
    entry.evidence_count > 0 &&
    entry.coverage >= params.corroborationCoverage &&
    entry.confidence >= params.certificationConfidence &&
    entry.level >= priorLevel &&
    priorResponse !== "REGRESSING" &&
    priorResponse !== "STALLED";

  const regressionTriggered =
    priorResponse === "REGRESSING" &&
    entry.evidence_count === 0;

  let certifiedLevel = Math.max(baseLevel, priorLevel);
  if (upshiftAllowed && baseLevel > priorLevel) {
    certifiedLevel = baseLevel;
  }
  // No automatic demotion: certifiedLevel never drops below prior unless
  // explicit regression evidence is present.
  if (regressionTriggered) {
    certifiedLevel = Math.max(1, Math.min(baseLevel, priorLevel - 1));
  }

  const transition =
    certifiedLevel !== priorLevel ? 1 + (priorEntry?.transition_count ?? 0) : (priorEntry?.transition_count ?? 0);

  return {
    level: certifiedLevel,
    capability: entry.capability,
    certified_level: microLevelAt(certifiedLevel),
    certified_at: transition > (priorEntry?.transition_count ?? 0) || !priorEntry ? now : (priorEntry?.certified_at ?? now),
    transition_count: transition,
  };
}

/**
 * Resolve the certified stable state from working state + prior stable state.
 *
 * Hysteresis guards:
 *   1. No automatic demotion.  A downward working reading sets DRIFT_RISK and
 *      keeps the certified level unless R5 (REGRESSING) evidence corroborates.
 *   2. No up-shift without corroboration.  Coverage + confidence gates at the
 *      canonical certification parameters.
 *   3. No churn.  `transition_count` only increments on real level movement.
 */
export function resolveStableState(
  input: HysteresisInput
): LP18StableState {
  const {
    working,
    priorStable,
    priorResponse,
    params: partialParams,
    certifiedAt,
  } = input;

  const params: HysteresisParams = {
    ...DEFAULT_HYSTERESIS_PARAMS,
    ...(partialParams ?? {}),
  };
  const now = certifiedAt ?? new Date().toISOString();

  const certifications = working.micro_levels.map((entry) =>
    resolveCapability(working, priorStable, entry, params, now, priorResponse)
  );

  // CEFR macro: macro of the highest certified capability (with evidence) —
  // the dominant certified band.
  const evidencedCapabilities = new Set(
    working.micro_levels
      .filter((m) => m.evidence_count > 0)
      .map((m) => m.capability)
  );
  const certifiedWithEvidence = certifications
    .filter((c) => evidencedCapabilities.has(c.capability))
    .sort((a, b) => b.level - a.level);
  const dominant = certifiedWithEvidence[0] ?? certifications[0];
  const cefrMacro = dominant ? cefrMacroOf(dominant.certified_level) : "A1";

  const hysteresisQualified = certifications.some((c) => {
    const workingEntry =
      working.micro_levels.find((m) => m.capability === c.capability) ?? null;
    return (
      workingEntry !== null &&
      workingEntry.evidence_count > 0 &&
      c.transition_count > 0 &&
      workingEntry.coverage >= params.corroborationCoverage
    );
  });

  return {
    micro_levels: certifications.map((c) => ({
      level: c.level,
      capability: c.capability,
      certified_level: c.certified_level,
      certified_at: c.certified_at,
      transition_count: c.transition_count,
    })),
    cefr_macro: cefrMacro,
    hysteresis_qualified: hysteresisQualified,
  };
}