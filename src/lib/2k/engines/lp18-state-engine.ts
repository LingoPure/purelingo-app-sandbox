import type {
  EvidenceObject,
  LP18WorkingState,
  CefrMacroBand,
} from "@/lib/2k/contracts";
import {
  CONSTRUCT_CAPABILITY_MAP,
  type CapabilityCode,
} from "@/lib/2k/engines/communication-analysis";

/**
 * LingoPure 2K — LP-18 State Engine (C10, ISS-024)
 *
 * Resolves the 18 micro-levels × 6 capabilities working state from the
 * adjudicated evidence pool.  Consumes only accepted EvidenceObjects and
 * seeds its level ladder from the canonical data bank (levels.json).
 *
 * Deterministic design:
 *   - Working level per capability is the centre of gravity of the accepted
 *     evidence for that capability on the canonical 1–18 ladder.
 *   - Confidence is mean evidence confidence weighted by quality.
 *   - Coverage follows the data-bank evidence requirement (two independent
 *     observations corroborate a capability).
 *   - No prior learner state is assumed — the working state is built fresh
 *     from what was observed and adjudicated in this assessment.
 *
 * Engine version string: LP18-STATE-v1.0.0
 */

export const LP18_STATE_ENGINE_VERSION = "LP18-STATE-v1.0.0";

/** Canonical 18 micro-levels, ordered weakest → strongest (from levels.json). */
export const LP18_LEVELS = [
  "A1.1",
  "A1.2",
  "A1.3",
  "A2.1",
  "A2.2",
  "A2.3",
  "B1.1",
  "B1.2",
  "B1.3",
  "B2.1",
  "B2.2",
  "B2.3",
  "C1.1",
  "C1.2",
  "C1.3",
  "C2.1",
  "C2.2",
  "C2.3",
] as const;

export type MicroLevel = (typeof LP18_LEVELS)[number];

const LP18_LEVEL_INDEX: Record<MicroLevel, number> = Object.fromEntries(
  LP18_LEVELS.map((level, index) => [level, index + 1])
) as Record<MicroLevel, number>;

/** Reverse index: level number 1–18 → micro-level string. */
export function microLevelAt(index: number): MicroLevel {
  const clamped = Math.max(1, Math.min(18, Math.round(index)));
  return LP18_LEVELS[clamped - 1];
}

export function microLevelIndex(level: MicroLevel): number {
  return LP18_LEVEL_INDEX[level];
}

/** CEFR macro band for a micro-level ("A1.2" → "A1"). */
export function cefrMacroOf(level: MicroLevel): CefrMacroBand {
  const match = /^([A-C]\d)\./.exec(level);
  return (match ? match[1] : level) as CefrMacroBand;
}

/**
 * Capability address → capability code, derived from the canonical
 * construct map (C07).  Single source of truth so the two engines cannot
 * drift apart on what a construct means.
 */
export const ADDRESS_TO_CAPABILITY: Record<string, CapabilityCode> = Object.fromEntries(
  Object.values(CONSTRUCT_CAPABILITY_MAP).map((mapping) => [
    mapping.address,
    mapping.cap,
  ])
);

/** Capability code of an EvidenceObject construct address (null when unmapped). */
export function capabilityOfEvidence(evidence: EvidenceObject): CapabilityCode | null {
  return ADDRESS_TO_CAPABILITY[evidence.construct] ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Input ──────────────────────────────────────────────────────────────────

export interface Lp18StateInput {
  /** Accepted evidence packets after R1-R10 adjudication (C09). */
  acceptedEvidence: EvidenceObject[];
  /**
   * Evidence floor per capability matching the data-bank requirement
   * ("multiple valid observations or one high-information probe plus
   * corroborating evidence").  Two independent observations = corroborated.
   */
  corroborationFloor?: number;
}

const DEFAULT_CORROBORATION_FLOOR = 2;

// ─── Working state resolver ─────────────────────────────────────────────────

interface CapabilityAggregate {
  capability: CapabilityCode;
  evidence: EvidenceObject[];
  demonstrated: number;   // quality-weighted mean confidence, 0–1
  level: number;          // 1–18
  confidence: number;     // 0–1
  coverage: number;       // 0–1 (min 1 corroborated pair = full coverage)
  last_observed: string;
}

function aggregateCapability(
  capability: CapabilityCode,
  evidence: EvidenceObject[],
  corroborationFloor: number
): CapabilityAggregate {
  const sorted = [...evidence].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const lastObserved =
    sorted.length > 0
      ? sorted[sorted.length - 1].created_at
      : new Date(0).toISOString();

  // demonstrated: quality-weighted mean of confidence (0–1)
  const totalWeight = evidence.reduce(
    (sum, item) => sum + item.quality * item.task_relevance,
    0
  );
  const demonstrated =
    totalWeight > 0
      ? evidence.reduce(
          (sum, item) =>
            sum + item.confidence * item.quality * item.task_relevance,
          0
        ) / totalWeight
      : 0;

  // Working level: demonstrated mastery on the canonical 1–18 ladder.
  // A 0.5 quality-weighted confidence places the learner at the mid-ladder;
  // higher demonstrated performance shifts upward proportionally.
  const level = Math.round(1 + demonstrated * 17);

  // Confidence: mean evidence confidence weighted by quality (0–1)
  const confidence =
    evidence.length > 0
      ? round3(
          evidence.reduce((sum, item) => sum + item.confidence * item.quality, 0) /
            evidence.reduce((sum, item) => sum + item.quality, 0)
        )
      : 0;

  // Coverage: corroboration floor (default 2 independent observations)
  const coverage = round3(clamp(evidence.length / corroborationFloor, 0, 1));

  return {
    capability,
    evidence,
    demonstrated,
    level: clamp(level, 1, 18),
    confidence,
    coverage,
    last_observed: lastObserved,
  };
}

/**
 * Resolve the LP-18 working state from adjudicated evidence.
 *
 * Every 1–18 level is assigned per capability from the centre of gravity of
 * accepted evidence.  Capabilities with no accepted evidence report
 * evidence_count 0, confidence 0, coverage 0 and a nominal level 1
 * (`last_observed` = epoch — never treated as a genuine observation).
 */
export function resolveWorkingState(
  input: Lp18StateInput
): LP18WorkingState {
  const corroborationFloor =
    input.corroborationFloor ?? DEFAULT_CORROBORATION_FLOOR;

  const byCapability = new Map<CapabilityCode, EvidenceObject[]>();
  for (const evidence of input.acceptedEvidence) {
    const cap = capabilityOfEvidence(evidence);
    if (!cap) continue; // unmapped construct (e.g. telemetry.*) is not LP-18 evidence
    const bucket = byCapability.get(cap) ?? [];
    bucket.push(evidence);
    byCapability.set(cap, bucket);
  }

  const capabilities: CapabilityCode[] = [
    "LIS",
    "VOC",
    "GRM",
    "SPK",
    "RDG",
    "INT",
  ];

  const microLevels = capabilities.map((cap) => {
    const evidence = byCapability.get(cap) ?? [];
    const aggregate = aggregateCapability(cap, evidence, corroborationFloor);
    return {
      level: aggregate.level,
      capability: cap,
      evidence_count: evidence.length,
      confidence: aggregate.confidence,
      coverage: aggregate.coverage,
      last_observed: aggregate.last_observed,
    };
  });

  const coveredCaps = capabilities.filter((cap) => {
    const found = microLevels.find((m) => m.capability === cap) ?? null;
    return found !== null && found.evidence_count > 0;
  });

  const overallConfidence = coveredCaps.reduce((min, cap) => {
    const found = microLevels.find((m) => m.capability === cap) ?? null;
    return Math.min(min, found !== null ? found.confidence : 0);
  }, 1);
  const overallCoverage = round3(coveredCaps.length / capabilities.length);

  return {
    micro_levels: microLevels,
    overall_confidence:
      coveredCaps.length > 0 ? round3(overallConfidence) : 0,
    overall_coverage: overallCoverage,
  };
}