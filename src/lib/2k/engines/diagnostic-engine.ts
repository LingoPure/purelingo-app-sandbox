import type {
  CanonicalAssessmentResult,
  LP18WorkingState,
  LP18StableState,
  DiagnosticArchetype,
  RecommendationFamily,
} from "@/lib/2k/contracts";
import {
  trajectoryMomentOf,
  type HysteresisInput,
} from "@/lib/2k/engines/hysteresis-engine";
import {
  SCORE_BANDS,
  bandForScore,
} from "@/lib/2k/engines/lp1000-engine";

/**
 * LingoPure 2K — Diagnostic engine (C14, ISS-028)
 *
 * Selects the archetype of the learner's primary gap from the evidence pool,
 * runtime telemetry and state trajectory.  The archetype taxonomy is the
 * canonical seed set (lp_rec_db.json `arch` field); the decision tree scores
 * each archetype against the telemetry dimensions it is most sensitive to
 * (d6_base.json), then falls through special guards (insufficient evidence,
 * do-not-train, progression-ready).
 *
 * Deterministic design:
 *   - Every candidate archetype gets a 0–1 affinity from telemetry gaps.
 *   - Argmax wins; the affinity become the diagnosis confidence.
 *   - Guard rails override the argmax: no evidence → abstain (CAPABILITY
 *     placeholder at low confidence); Strategic Mastery + stable → DO_NOT_TRAIN;
 *     rising stable state → PROGRESSION_READY.
 *
 * Engine version string: DIAG-ARC-v1.0.0
 */

export const DIAGNOSIS_ENGINE_VERSION = "DIAG-ARC-v1.0.0";

// ─── Archetype ↔ issue-family mapping (bank-seeded) ─────────────────────────

export const ARCHETYPE_FAMILY_MAP: Record<
  DiagnosticArchetype,
  { family: RecommendationFamily; name: string; action_class: string }
> = {
  CAPABILITY: {
    family: "A",
    name: "Capability Gap",
    action_class: "CAPABILITY_BUILD",
  },
  AUTOMATICITY: {
    family: "B",
    name: "Stability Gap",
    action_class: "AUTOMATICITY_PRACTICE",
  },
  TRANSFER: {
    family: "C",
    name: "Context Transfer Gap",
    action_class: "LATERAL_TRANSFER",
  },
  CONTRADICTION_CONFLICT: {
    family: "D",
    name: "Repair & Recovery Gap",
    action_class: "RESOLVE_CONFLICT",
  },
  COGNITIVE_OVERLOAD: {
    family: "E",
    name: "Cognitive Load Gap",
    action_class: "LOAD_CALIBRATION",
  },
  HIERARCHY_PRESSURE: {
    family: "G",
    name: "Cultural / Relational Gap",
    action_class: "HIERARCHY_CALIBRATION",
  },
  SEMANTIC_DRIFT: {
    family: "I",
    name: "Convergence / Drift Gap",
    action_class: "SEMANTIC_REPAIR",
  },
  CONTEXT: {
    family: "C",
    name: "Context Transfer Gap",
    action_class: "LATERAL_TRANSFER",
  },
  PROGRESSION_READY: {
    family: "J",
    name: "Progression Control — probe next state",
    action_class: "PROBE_NEXT_STATE",
  },
  DO_NOT_TRAIN: {
    family: "J",
    name: "Progression Control — do not train (contraindicated)",
    action_class: "DO_NOT_TRAIN",
  },
} as const;

// ─── Input ──────────────────────────────────────────────────────────────────

export interface DiagnosisInput {
  working: LP18WorkingState;
  stable: LP18StableState;
  telemetry: CanonicalAssessmentResult["telemetry"];
  lp1000: CanonicalAssessmentResult["lp1000"];
  hysteresis: HysteresisInput;
}

interface ArchetypeAffinity {
  archetype: DiagnosticArchetype;
  affinity: number;
}

function telemetryMap(
  telemetry: CanonicalAssessmentResult["telemetry"]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const dim of telemetry.dimensions) {
    map[dim.name] = dim.score;
  }
  return map;
}

function gap(dimensionScore: number): number {
  return 1 - Math.max(0, Math.min(1, dimensionScore));
}

// ─── Decision tree ──────────────────────────────────────────────────────────

/**
 * Resolve the best archetype affinity vector from the telemetry signature.
 */
export function archetypeAffinities(
  telemetry: CanonicalAssessmentResult["telemetry"]
): ArchetypeAffinity[] {
  const t = telemetryMap(telemetry);
  const s = (name: string): number => t[name] ?? 0;

  const candidates: ArchetypeAffinity[] = [
    {
      archetype: "CAPABILITY",
      affinity: 0.35 + 0.15 * gap(s("Semantic Continuity")),
    },
    {
      archetype: "AUTOMATICITY",
      affinity:
        0.45 * gap(s("Hesitation Markers")) +
        0.3 * gap(s("Response Latency")) +
        0.25 * gap(s("Repair Behaviour")),
    },
    {
      archetype: "TRANSFER",
      affinity:
        0.5 * gap(s("Adaptive Shifting")) +
        0.3 * gap(s("Semantic Continuity")) +
        0.2 * gap(s("Cultural Continuity")),
    },
    {
      archetype: "CONTRADICTION_CONFLICT",
      affinity:
        0.5 * gap(s("Repair Behaviour")) +
        0.3 * gap(s("Frame Integrity")) +
        0.2 * gap(s("Semantic Continuity")),
    },
    {
      archetype: "COGNITIVE_OVERLOAD",
      affinity:
        0.45 * gap(s("Cognitive Load Alignment")) +
        0.3 * gap(s("Response Latency")) +
        0.25 * gap(s("Hesitation Markers")),
    },
    {
      archetype: "HIERARCHY_PRESSURE",
      affinity:
        0.5 * gap(s("Hierarchy Sensitivity")) +
        0.3 * gap(s("Tone Alignment")) +
        0.2 * gap(s("Adaptive Shifting")),
    },
    {
      archetype: "SEMANTIC_DRIFT",
      affinity:
        0.5 * gap(s("Semantic Continuity")) +
        0.3 * gap(s("Drift Detection")) +
        0.2 * gap(s("Frame Integrity")),
    },
    {
      archetype: "CONTEXT",
      affinity:
        0.5 * gap(s("Cultural Continuity")) +
        0.3 * gap(s("Tone Alignment")) +
        0.2 * gap(s("Hierarchy Sensitivity")),
    },
  ];

  return candidates.map((c) => ({ ...c, affinity: round3(c.affinity) }));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolve the diagnosis.  Pure and deterministic; seeded from the data banks.
 */
export function diagnose(input: DiagnosisInput): CanonicalAssessmentResult["diagnosis"] {
  const { working, stable, telemetry, lp1000, hysteresis } = input;

  const moment = trajectoryMomentOf(
    working,
    hysteresis.priorStable,
    hysteresis.params
  );

  // Guard 1: no usable evidence → abstain (CAPABILITY placeholder).
  if (working.overall_coverage === 0) {
    return {
      archetype: "CAPABILITY",
      gap_origin: `${ARCHETYPE_FAMILY_MAP["CAPABILITY"].family}: ${ARCHETYPE_FAMILY_MAP["CAPABILITY"].name} (insufficient evidence — abstained, confidence 0.1)`,
      confidence: 0.1,
    };
  }

  // Guard 2: Strategic Mastery + stable → contraindicated.
  const band = bandForScore(lp1000.score);
  if (
    band.band_id === "SB6" &&
    (moment.state === "STABLE_PROFESSIONAL" || moment.state === "RISING_CONVERGENCE")
  ) {
    const mapping = ARCHETYPE_FAMILY_MAP["DO_NOT_TRAIN"];
    return {
      archetype: "DO_NOT_TRAIN",
      gap_origin: `${mapping.family}: ${mapping.name} — ${SCORE_BANDS[5].state_focus}`,
      confidence: round3(clamp(0.5 + lp1000.confidence * 0.5, 0.1, 0.9)),
    };
  }

  // Guard 3: rising stable state + hysteresis qualified → next-state probe.
  if (
    stable.hysteresis_qualified &&
    (moment.state === "RAPID_ADAPTATION" || moment.state === "RISING_CONVERGENCE") &&
    lp1000.score >= 350
  ) {
    const mapping = ARCHETYPE_FAMILY_MAP["PROGRESSION_READY"];
    return {
      archetype: "PROGRESSION_READY",
      gap_origin: `${mapping.family}: ${mapping.name} — ${moment.action_rule}`,
      confidence: round3(clamp(0.5 + lp1000.confidence * 0.5, 0.1, 0.9)),
    };
  }

  // General case: argmax affinity.
  const affinities = archetypeAffinities(telemetry);
  const best = affinities.reduce((a, b) => (a.affinity >= b.affinity ? a : b));
  const mapping = ARCHETYPE_FAMILY_MAP[best.archetype] ?? ARCHETYPE_FAMILY_MAP["CAPABILITY"];

  const confidence = round3(
    clamp(
      best.affinity *
        (stable.hysteresis_qualified ? 0.6 : 0.4) *
        (0.4 + 0.6 * lp1000.confidence),
      0.05,
      0.95
    )
  );

  return {
    archetype: best.archetype,
    gap_origin: `${mapping.family}: ${mapping.name}`,
    confidence,
  };
}