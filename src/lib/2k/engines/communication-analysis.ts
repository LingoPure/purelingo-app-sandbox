/**
 * LingoPure 2K — Communication Analysis Object engine (C07, ISS-021)
 *
 * Pure, deterministic engine that transforms one response's assets into a
 * `CommunicationAnalysisObject` (C05 contract).  Every claim is seeded from
 * the canonical data banks (lp_rec_db.json, interventions.json, d6_base.json,
 * tele.json) and labelled with evidence_status / directness / confidence so
 * downstream components (C08–C15) can govern or discard each observation.
 *
 * Deterministic-no-side-effects design means:
 *   - Same inputs always produce the same output.
 *   - No network, DB or model call.
 *   - Every derivable metric is derived from real observable data
 *     (signals, transcript surface, question stage/contract, session context).
 *   - Semantic analysis beyond surface text requires an external lens; the
 *     engine abstains honestly rather than fabricate meaning.
 *
 * Engine version string: CAO-RULE-v1.0.0
 */

import type {
  AtomicAudioSignal,
  CommunicationAnalysisObject,
  EvidenceAuthority,
  EvidenceStatus,
  Modality,
  ResponseObject,
  TranscriptObject,
} from "@/lib/2k/contracts";
import type { QuestionDefinition } from "@/lib/2k/question-bank";

// ─── Canonical telemetry vocabulary (12D, from tele.json + d6_base.json) ────

export const TELEMETRY_12D = [
  "Semantic Continuity",
  "Frame Integrity",
  "Cognitive Load Alignment",
  "Response Latency",
  "Hesitation Markers",
  "Repair Behaviour",
  "Tone Alignment",
  "Adaptive Shifting",
  "Turn-Taking Behaviour",
  "Hierarchy Sensitivity",
  "Cultural Continuity",
  "Drift Detection",
] as const;

export type CanonicalTelemetryDimension = (typeof TELEMETRY_12D)[number];

// ─── Capability codes and names (from lp_rec_db.json) ──────────────────────

export type CapabilityCode = "LIS" | "VOC" | "GRM" | "SPK" | "RDG" | "INT";

export const CAPABILITY_CODE_MAP: Record<
  CapabilityCode,
  { name: string; shortName: string }
> = {
  LIS: { name: "Listening", shortName: "LIS" },
  VOC: { name: "Vocabulary", shortName: "VOC" },
  GRM: { name: "Grammar", shortName: "GRM" },
  SPK: { name: "Speaking", shortName: "SPK" },
  RDG: { name: "Reading", shortName: "RDG" },
  INT: { name: "Live Interaction", shortName: "INT" },
};

// ─── Per-capability telemetry base weights (d6_base.json) ──────────────────

export const D6_TELEMETRY_BASE_WEIGHTS: Record<
  CapabilityCode,
  Record<CanonicalTelemetryDimension, number>
> = {
  LIS: {
    "Semantic Continuity": 0.88,
    "Frame Integrity": 0.42,
    "Cognitive Load Alignment": 0.46,
    "Response Latency": 0.52,
    "Hesitation Markers": 0.3,
    "Repair Behaviour": 0.48,
    "Tone Alignment": 0.22,
    "Adaptive Shifting": 0.28,
    "Turn-Taking Behaviour": 0.44,
    "Hierarchy Sensitivity": 0.18,
    "Cultural Continuity": 0.18,
    "Drift Detection": 0.45,
  },
  VOC: {
    "Semantic Continuity": 0.84,
    "Frame Integrity": 0.68,
    "Cognitive Load Alignment": 0.62,
    "Response Latency": 0.18,
    "Hesitation Markers": 0.22,
    "Repair Behaviour": 0.34,
    "Tone Alignment": 0.34,
    "Adaptive Shifting": 0.58,
    "Turn-Taking Behaviour": 0.12,
    "Hierarchy Sensitivity": 0.28,
    "Cultural Continuity": 0.42,
    "Drift Detection": 0.42,
  },
  GRM: {
    "Semantic Continuity": 0.66,
    "Frame Integrity": 0.86,
    "Cognitive Load Alignment": 0.72,
    "Response Latency": 0.22,
    "Hesitation Markers": 0.28,
    "Repair Behaviour": 0.34,
    "Tone Alignment": 0.16,
    "Adaptive Shifting": 0.36,
    "Turn-Taking Behaviour": 0.12,
    "Hierarchy Sensitivity": 0.16,
    "Cultural Continuity": 0.14,
    "Drift Detection": 0.38,
  },
  SPK: {
    "Semantic Continuity": 0.7,
    "Frame Integrity": 0.54,
    "Cognitive Load Alignment": 0.72,
    "Response Latency": 0.74,
    "Hesitation Markers": 0.72,
    "Repair Behaviour": 0.66,
    "Tone Alignment": 0.62,
    "Adaptive Shifting": 0.72,
    "Turn-Taking Behaviour": 0.58,
    "Hierarchy Sensitivity": 0.42,
    "Cultural Continuity": 0.34,
    "Drift Detection": 0.56,
  },
  RDG: {
    "Semantic Continuity": 0.9,
    "Frame Integrity": 0.72,
    "Cognitive Load Alignment": 0.66,
    "Response Latency": 0.18,
    "Hesitation Markers": 0.1,
    "Repair Behaviour": 0.18,
    "Tone Alignment": 0.08,
    "Adaptive Shifting": 0.22,
    "Turn-Taking Behaviour": 0.04,
    "Hierarchy Sensitivity": 0.12,
    "Cultural Continuity": 0.28,
    "Drift Detection": 0.34,
  },
  INT: {
    "Semantic Continuity": 0.92,
    "Frame Integrity": 0.78,
    "Cognitive Load Alignment": 0.8,
    "Response Latency": 0.84,
    "Hesitation Markers": 0.68,
    "Repair Behaviour": 0.94,
    "Tone Alignment": 0.78,
    "Adaptive Shifting": 0.92,
    "Turn-Taking Behaviour": 0.94,
    "Hierarchy Sensitivity": 0.82,
    "Cultural Continuity": 0.74,
    "Drift Detection": 0.86,
  },
};

// ─── Canonical construct → capability-address mapping (bank-seeded) ─────────

export interface ConstructMapping {
  cap: CapabilityCode;
  address: string;
  telemetry: readonly CanonicalTelemetryDimension[];
}

export const CONSTRUCT_CAPABILITY_MAP: Record<string, ConstructMapping> = {
  task_fulfilment: {
    cap: "INT",
    address: "task.task_management",
    telemetry: ["Cognitive Load Alignment", "Semantic Continuity"],
  },
  structure: {
    cap: "SPK",
    address: "speaking.structure",
    telemetry: ["Frame Integrity", "Semantic Continuity"],
  },
  causal_reasoning: {
    cap: "INT",
    address: "task.causal_reasoning",
    telemetry: ["Semantic Continuity", "Frame Integrity"],
  },
  decision_quality: {
    cap: "INT",
    address: "task.decision_quality",
    telemetry: ["Cognitive Load Alignment", "Hierarchy Sensitivity"],
  },
  comparative_reasoning: {
    cap: "INT",
    address: "task.comparative_reasoning",
    telemetry: ["Adaptive Shifting", "Frame Integrity"],
  },
  perspective_integrity: {
    cap: "INT",
    address: "interaction.perspective_integrity",
    telemetry: ["Turn-Taking Behaviour", "Semantic Continuity"],
  },
  uncertainty_handling: {
    cap: "INT",
    address: "task.uncertainty_handling",
    telemetry: ["Cognitive Load Alignment", "Drift Detection"],
  },
  audience_adaptation: {
    cap: "INT",
    address: "interaction.audience_adaptation",
    telemetry: ["Adaptive Shifting", "Hierarchy Sensitivity"],
  },
  reasoning: {
    cap: "INT",
    address: "task.reasoning",
    telemetry: ["Frame Integrity", "Semantic Continuity"],
  },
  conditional_reasoning: {
    cap: "INT",
    address: "task.conditional_reasoning",
    telemetry: ["Cognitive Load Alignment", "Frame Integrity"],
  },
  evidence_discipline: {
    cap: "INT",
    address: "task.evidence_discipline",
    telemetry: ["Drift Detection", "Cognitive Load Alignment"],
  },
  semantic_integrity: {
    cap: "VOC",
    address: "meaning.semantic_integrity",
    telemetry: ["Semantic Continuity", "Frame Integrity"],
  },
  meaning_precision: {
    cap: "VOC",
    address: "vocabulary.meaning_precision",
    telemetry: ["Semantic Continuity", "Adaptive Shifting"],
  },
  compression: {
    cap: "SPK",
    address: "speaking.compression",
    telemetry: ["Adaptive Shifting", "Semantic Continuity"],
  },
  context_fit: {
    cap: "INT",
    address: "interaction.context_fit",
    telemetry: ["Adaptive Shifting", "Cultural Continuity"],
  },
  synthesis: {
    cap: "INT",
    address: "task.synthesis",
    telemetry: ["Frame Integrity", "Semantic Continuity"],
  },
  adaptation: {
    cap: "INT",
    address: "interaction.adaptation",
    telemetry: ["Adaptive Shifting", "Turn-Taking Behaviour"],
  },
  interaction: {
    cap: "INT",
    address: "interaction.turn_taking",
    telemetry: ["Turn-Taking Behaviour", "Tone Alignment"],
  },
  repair: {
    cap: "SPK",
    address: "speaking.repair_language",
    telemetry: ["Repair Behaviour", "Semantic Continuity"],
  },
  stakeholder_calibration: {
    cap: "INT",
    address: "interaction.hierarchy_fit",
    telemetry: ["Hierarchy Sensitivity", "Turn-Taking Behaviour"],
  },
  executive_density: {
    cap: "SPK",
    address: "speaking.executive_density",
    telemetry: ["Response Latency", "Adaptive Shifting"],
  },
  state_update: {
    cap: "INT",
    address: "task.state_update",
    telemetry: ["Drift Detection", "Adaptive Shifting"],
  },
  strategic_reasoning: {
    cap: "INT",
    address: "task.strategic_reasoning",
    telemetry: ["Hierarchy Sensitivity", "Cognitive Load Alignment"],
  },
};

// ─── Canonical bank governance constants (from lp_rec_db.json) ──────────────

export const CANONICAL_EVIDENCE_REQUIREMENT =
  "Multiple valid observations or one high-information probe plus corroborating evidence; task must genuinely test the target capability.";

export const CANONICAL_COUNTER_EVIDENCE =
  "Successful independent performance in a novel comparable task; evidence that failure came from receiver/channel/domain rather than learner capability.";

export const CANONICAL_DO_NOT_INFER =
  "One pause; accent; one error; speaking speed alone; directness alone; confidence impression; culturally ambiguous behaviour without context.";

// ─── Canonical archetype names (from lp_rec_db.json) ───────────────────────

export const CANONICAL_ARCHETYPES = [
  "AUTOMATICITY",
  "CAPABILITY",
  "COGNITIVE_OVERLOAD",
  "CONTEXT",
  "CONTRADICTION_CONFLICT",
  "DO_NOT_TRAIN",
  "HIERARCHY_PRESSURE",
  "PROGRESSION_READY",
  "SEMANTIC_DRIFT",
  "TRANSFER",
] as const;

// ─── Canonical action classes (from lp_rec_db.json) ────────────────────────

export const CANONICAL_ACTION_CLASSES = [
  "AUTOMATICITY_PRACTICE",
  "BEHAVIOUR_INTERVENTION",
  "CAPABILITY_BUILD",
  "DO_NOT_TRAIN",
  "HIERARCHY_CALIBRATION",
  "LATERAL_TRANSFER",
  "LOAD_CALIBRATION",
  "PROBE_NEXT_STATE",
  "RESOLVE_CONFLICT",
  "SEMANTIC_REPAIR",
] as const;

// ─── Engine version ─────────────────────────────────────────────────────────

export const CAO_ENGINE_VERSION = "CAO-RULE-v1.0.0";
export const CAO_SCHEMA_VERSION = "c05.v1";
export const CAO_RULE_VERSION = "canonical-bank-v6.1/seeds-1080-rules";

// ─── Input / output types ───────────────────────────────────────────────────

export interface CommunicationAnalysisContext {
  receiver?: string;
  relationship?: string;
  hierarchy?: string;
  professionalDomain?: string;
  objective?: string;
  channel?: string;
  culture?: string;
  languagePair?: string;
}

export interface CommunicationAnalysisInput {
  response: ResponseObject;
  transcript?: TranscriptObject | null;
  signals: AtomicAudioSignal[];
  question: QuestionDefinition;
  context?: Partial<CommunicationAnalysisContext>;
  analysisId?: string;
  interactionId?: string;
  eventIds?: string[];
  ruleVersion?: string;
}

// ─── Surface metrics (deterministic transcript analysis) ────────────────────

interface SurfaceMetrics {
  tokenCount: number;
  sentenceCount: number;
  averageSentenceWords: number;
  uniqueTokenRatio: number;
  fillerRatio: number;
  repairMarkerCount: number;
  repairMarkerRatio: number;
  discourseMarkerCount: number;
  discourseMarkerDensity: number;
  clarificationMarkerCount: number;
  hedgeMarkerCount: number;
  contrastiveFlipCount: number;
  hasContent: boolean;
}

const FILLER_LEXICON = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+\b/gi,
  /\berm+\b/gi,
  /\bhmm+\b/gi,
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bbasically\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
];

const REPAIR_LEXICON = [
  /\bi mean\b/gi,
  /\bsorry[,.]?\b/gi,
  /\bactually[,.]?\b/gi,
  /\brather[,.]?\b/gi,
  /\bthat is[,.]?\b/gi,
  /\bi meant\b/gi,
  /\bi should say\b/gi,
  /\bno wait\b/gi,
  /\bpardon[,.]?\b/gi,
  /\blet me correct\b/gi,
  /\bbetter said\b/gi,
  /\binstead[,.]?\b/gi,
];

const DISCOURSE_LEXICON = [
  /\bfirst\b/gi,
  /\bthen\b/gi,
  /\bnext\b/gi,
  /\bafter\b/gi,
  /\bbecause\b/gi,
  /\bbut\b/gi,
  /\balso\b/gi,
  /\bhowever\b/gi,
  /\btherefore\b/gi,
  /\bso\b/gi,
  /\bfor example\b/gi,
  /\bsecond\b/gi,
  /\bthird\b/gi,
  /\bfinally\b/gi,
  /\bin other words\b/gi,
  /\bin addition\b/gi,
];

const CLARIFICATION_LEXICON = [
  /\bcould you repeat\b/gi,
  /\bcan you say\b/gi,
  /\bwhat i mean\b/gi,
  /\bto clarify\b/gi,
  /\bin other words\b/gi,
  /\blet me explain\b/gi,
  /\bthe point is\b/gi,
  /\bwhat i'?m saying\b/gi,
];

const HEDGE_LEXICON = [
  /\bmaybe\b/gi,
  /\bperhaps\b/gi,
  /\bmight\b/gi,
  /\bcould\b/gi,
  /\bnot sure\b/gi,
  /\bit depends\b/gi,
  /\bpossibly\b/gi,
  /\buncertain\b/gi,
  /\bunclear\b/gi,
];

const CONTRASTIVE_LEXICON = [
  /\bbut\b/gi,
  /\bhowever\b/gi,
  /\byet\b/gi,
  /\bon the other hand\b/gi,
  /\balthough\b/gi,
  /\bthough\b/gi,
  /\bdespite\b/gi,
  /\bnevertheless\b/gi,
];

const NEGATION_LEXICON = [
  /\bdon'?t\b/gi,
  /\bdoesn'?t\b/gi,
  /\bdidn'?t\b/gi,
  /\bwon'?t\b/gi,
  /\bwouldn'?t\b/gi,
  /\bcan'?t\b/gi,
  /\bcouldn'?t\b/gi,
  /\bno\b/gi,
  /\bnot\b/gi,
  /\bnever\b/gi,
  /\bneither\b/gi,
  /\bnor\b/gi,
];

function tokenize(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

function extractMatches(text: string, patterns: readonly RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    count += Array.from(text.matchAll(re)).length;
  }
  return count;
}

function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const raw = trimmed
    .replace(/([.!?])(?=\s+|\s*$)/g, "$1\u0000")
    .split("\u0000")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return raw;
}

function computeSurfaceMetrics(text: string): SurfaceMetrics {
  const tokens = tokenize(text);
  const tokenCount = tokens.length;
  const sentences = splitSentences(text);
  const sentenceCount = sentences.length;

  const averageSentenceWords =
    sentenceCount > 0
      ? Math.round((tokenCount / sentenceCount) * 100) / 100
      : 0;

  const uniqueTokens = new Set(
    tokens.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  const filteredNonEmpty = Array.from(uniqueTokens).filter((t) => t.length > 0);
  const uniqueTokenRatio =
    tokenCount > 0
      ? Math.round((filteredNonEmpty.length / tokenCount) * 1000) / 1000
      : 0;

  const fillerHits = extractMatches(text, FILLER_LEXICON);
  const fillerRatio =
    tokenCount > 0
      ? Math.round((fillerHits / tokenCount) * 1000) / 1000
      : 0;

  const repairHits = extractMatches(text, REPAIR_LEXICON);
  const repairMarkerRatio =
    tokenCount > 0
      ? Math.round((repairHits / tokenCount) * 1000) / 1000
      : 0;

  const discourseHits = extractMatches(text, DISCOURSE_LEXICON);
  const discourseMarkerDensity =
    sentenceCount > 0
      ? Math.round((discourseHits / sentenceCount) * 1000) / 1000
      : 0;

  const clarificationHits = extractMatches(text, CLARIFICATION_LEXICON);
  const hedgeHits = extractMatches(text, HEDGE_LEXICON);
  const contrastiveHits = extractMatches(text, CONTRASTIVE_LEXICON);
  const negationHits = extractMatches(text, NEGATION_LEXICON);

  const contrastiveFlipCount = Math.min(contrastiveHits, negationHits);

  const hasContent = tokenCount >= 10;

  return {
    tokenCount,
    sentenceCount,
    averageSentenceWords,
    uniqueTokenRatio,
    fillerRatio,
    repairMarkerCount: repairHits,
    repairMarkerRatio,
    discourseMarkerCount: discourseHits,
    discourseMarkerDensity,
    clarificationMarkerCount: clarificationHits,
    hedgeMarkerCount: hedgeHits,
    contrastiveFlipCount,
    hasContent,
  };
}

// ─── Signal → telemetry normalisation ────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const SIGNAL_TO_TELEMETRY: Partial<
  Record<string, CanonicalTelemetryDimension>
> = {
  latency: "Response Latency",
  pause_count: "Hesitation Markers",
  pitch_energy: "Tone Alignment",
  repair_timing: "Repair Behaviour",
  intelligibility: "Semantic Continuity",
  speech_rate: "Cognitive Load Alignment",
  turn_switch_latency: "Turn-Taking Behaviour",
  durational_consistency: "Frame Integrity",
  adaptive_shift_signal: "Adaptive Shifting",
  cultural_match: "Cultural Continuity",
  drift_signal: "Drift Detection",
};

function normaliseLatency(ms: number): number {
  return round3(clamp(1 - ms / 3000, 0, 1));
}

function normaliseHesitation(pauseCount: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return round3(clamp(1 - pauseCount / (durationSec * 0.5), 0, 1));
}

function normaliseRepairTiming(ms: number): number {
  return round3(clamp(1 - ms / 2500, 0, 1));
}

function normaliseSpeechRate(wpm: number): number {
  const mid = 140;
  const spread = 80;
  return round3(clamp(1 - Math.abs(wpm - mid) / spread, 0, 1));
}

function normaliseTurnSwitch(ms: number): number {
  return round3(clamp(1 - ms / 2000, 0, 1));
}

function normaliseDurationalConsistency(variance: number): number {
  return round3(clamp(1 - variance / 0.5, 0, 1));
}

function normaliseScoreLike(value: number): number {
  return round3(clamp(value, 0, 1));
}

function normaliseSignalValue(
  signal: AtomicAudioSignal,
  durationSec: number
): { score: number; confidence: number } {
  const val = typeof signal.value === "number" ? signal.value : 0;
  const conf = clamp(signal.confidence, 0, 1);
  switch (signal.signal_type) {
    case "latency":
      return { score: normaliseLatency(val), confidence: conf };
    case "pause_count":
      return { score: normaliseHesitation(val, durationSec), confidence: conf };
    case "repair_timing":
      return { score: normaliseRepairTiming(val), confidence: conf };
    case "speech_rate":
      return {
        score: normaliseSpeechRate(val),
        confidence: conf,
      };
    case "turn_switch_latency":
      return { score: normaliseTurnSwitch(val), confidence: conf };
    case "durational_consistency":
      return {
        score: normaliseDurationalConsistency(Math.abs(val)),
        confidence: conf,
      };
    case "pitch_energy":
    case "intelligibility":
    case "adaptive_shift_signal":
    case "cultural_match":
    case "drift_signal":
    default:
      return { score: normaliseScoreLike(val), confidence: conf };
  }
}

// ─── Derived telemetry from transcript surface ───────────────────────────────

interface DerivedTelemetryEntry {
  dimension: CanonicalTelemetryDimension;
  score: number;
  confidence: number;
  evidenceStatus: EvidenceStatus;
  evidenceIds: string[];
  source: string;
  directness: EvidenceAuthority;
}

function deriveSurfaceTelemetry(
  _text: string,
  surface: SurfaceMetrics,
  responseId: string,
  transcriptId?: string
): DerivedTelemetryEntry[] {
  const evidenceIds = transcriptId
    ? [responseId, `transcript:${transcriptId}`]
    : [responseId, "client_transcript"];

  const entries: DerivedTelemetryEntry[] = [];

  if (surface.hasContent) {
    entries.push({
      dimension: "Semantic Continuity",
      score: round3(clamp(surface.discourseMarkerDensity / 0.6, 0, 1)),
      confidence: 0.35,
      evidenceStatus: "OBSERVED",
      evidenceIds,
      source: "transcript:discourse_density",
      directness: "DERIVED",
    });

    entries.push({
      dimension: "Hesitation Markers",
      score: round3(clamp(1 - surface.fillerRatio * 10, 0, 1)),
      confidence: 0.4,
      evidenceStatus: "OBSERVED",
      evidenceIds,
      source: "transcript:filler_ratio",
      directness: "DERIVED",
    });

    entries.push({
      dimension: "Frame Integrity",
      score: round3(
        clamp(
          0.4 +
            surface.discourseMarkerDensity * 0.3 +
            (surface.sentenceCount >= 3 ? 0.15 : 0) +
            (surface.averageSentenceWords >= 8 ? 0.15 : 0),
          0,
          1
        )
      ),
      confidence: 0.3,
      evidenceStatus: "OBSERVED",
      evidenceIds,
      source: "transcript:connectivity",
      directness: "DERIVED",
    });

    entries.push({
      dimension: "Adaptive Shifting",
      score: round3(
        clamp(
          0.5 +
            Math.min(0.3, surface.hedgeMarkerCount * 0.05) -
            surface.contrastiveFlipCount * 0.04,
          0,
          1
        )
      ),
      confidence: 0.25,
      evidenceStatus: "OBSERVED",
      evidenceIds,
      source: "transcript:hedge_density",
      directness: "INFERRED",
    });

    entries.push({
      dimension: "Repair Behaviour",
      score: round3(clamp(0.5 + surface.repairMarkerCount * 0.12, 0, 1)),
      confidence: 0.3,
      evidenceStatus: "OBSERVED",
      evidenceIds,
      source: "transcript:repair_markers",
      directness: "DERIVED",
    });

    entries.push({
      dimension: "Drift Detection",
      score: round3(
        clamp(0.5 + surface.contrastiveFlipCount * 0.08, 0, 1)
      ),
      confidence: 0.2,
      evidenceStatus: "OBSERVED",
      evidenceIds,
      source: "transcript:contrastive_flips",
      directness: "INFERRED",
    });
  }

  return entries;
}

// ─── Content analysis (deterministic surface) ───────────────────────────────

const STAGE_INTENTS: Record<string, string> = {
  LOCATE:
    "Locate level/ability: describe routine, preferences, a past event, a decision, or a nuanced situation to establish a baseline.",
  BOUND:
    "Bound capability: explain a familiar topic to a layperson, reason over multiple causes, compare solutions, adapt a plan under constraints.",
  RESOLVE:
    "Resolve meaning: establish precise vocabulary, map causal chains, compress without losing key information, build recommendations from fragments.",
  PERTURB:
    "Perturb context: re-express for a different receiver, repair a misunderstanding, calibrate tone and framing to hierarchy and urgency.",
  CONFIRM:
    "Confirm meaning under pressure: give conditional recommendations, adapt to changed conditions, preserve both sides fairly, reason under ambiguity.",
};

function produceContentAnalysis(
  question: QuestionDefinition,
  text: string,
  surface: SurfaceMetrics
): CommunicationAnalysisObject["content_analysis"] {
  const intent = STAGE_INTENTS[question.stage] ?? "General communication";

  const sentences = splitSentences(text);
  const meaning =
    sentences.length > 0
      ? sentences[0].slice(0, 120) + (sentences[0].length > 120 ? "..." : "")
      : "";

  const keyInformation = question.contract.required.map(
    (item) => `[contracted] ${item}`
  );

  const stageFloorByStage: Record<string, number> = {
    LOCATE: 20,
    BOUND: 30,
    RESOLVE: 40,
    PERTURB: 25,
    CONFIRM: 20,
  };
  const floor = stageFloorByStage[question.stage] ?? 25;
  const stageBase =
    question.stage === "PERTURB" || question.stage === "CONFIRM" ? 0.55 : 0.5;
  const lengthBonus = surface.tokenCount >= floor ? 0.15 : 0;
  const contentGate = surface.hasContent ? 0.05 : 0;
  const discourseBonus = surface.discourseMarkerDensity > 0.4 ? 0.05 : 0;
  const taskFulfilment = round3(
    clamp(stageBase + lengthBonus + contentGate + discourseBonus, 0, 1)
  );

  const ambiguity: string[] = [];
  if (surface.hedgeMarkerCount >= 2) {
    ambiguity.push(
      `${surface.hedgeMarkerCount} hedge phrases detected (maybe, perhaps, could, depends) — meaning may not be committed`
    );
  }
  if (surface.contrastiveFlipCount >= 2) {
    ambiguity.push(
      `${surface.contrastiveFlipCount} contrastive flips detected — position may be internally contradictory or pivot-heavy`
    );
  }

  const contradictions: string[] = [];
  if (surface.contrastiveFlipCount >= 2) {
    contradictions.push(
      `${surface.contrastiveFlipCount} contrastive-flip candidates flagged (surface heuristic — semantic verification required)`
    );
  }

  return {
    intent,
    meaning,
    key_information: keyInformation,
    task_fulfilment: taskFulfilment,
    omissions: [],
    ambiguity,
    contradictions,
  };
}

// ─── Linguistic analysis (deterministic surface) ────────────────────────────

function produceLinguisticAnalysis(
  surface: SurfaceMetrics,
  signals: AtomicAudioSignal[],
  durationSec: number,
  hasTranscript: boolean
): CommunicationAnalysisObject["linguistic_analysis"] {
  const intelligibilitySignal = signals.find(
    (s) => s.signal_type === "intelligibility"
  );

  let fluencyScore = 0;
  if (durationSec > 0 && surface.tokenCount > 0) {
    const wpm = (surface.tokenCount / durationSec) * 60;
    fluencyScore = normaliseSpeechRate(wpm);
  } else if (intelligibilitySignal) {
    fluencyScore = normaliseScoreLike(
      typeof intelligibilitySignal.value === "number"
        ? intelligibilitySignal.value
        : 0
    );
  }
  const fluencyPenalty = clamp(surface.fillerRatio * 3, 0, 0.3);
  const fluency = hasTranscript
    ? round3(clamp(fluencyScore - fluencyPenalty, 0, 1))
    : 0;

  const vocabulary = hasTranscript
    ? round3(clamp(surface.uniqueTokenRatio, 0, 1))
    : 0;

  const grammar = 0;

  const structure = hasTranscript
    ? round3(clamp(surface.discourseMarkerDensity / 0.6, 0, 1))
    : 0;

  const connectivityBase = hasTranscript
    ? round3(
        clamp(
          0.4 +
            surface.discourseMarkerDensity * 0.3 +
            (surface.sentenceCount >= 3 ? 0.2 : 0),
          0,
          1
        )
      )
    : 0;
  const coherence = round3(
    clamp(
      connectivityBase +
        (intelligibilitySignal
          ? normaliseScoreLike(
              typeof intelligibilitySignal.value === "number"
                ? intelligibilitySignal.value
                : 0
            ) * 0.25
          : 0),
      0,
      1
    )
  );

  const complexity = hasTranscript
    ? round3(clamp((surface.averageSentenceWords - 4) / (28 - 4), 0, 1))
    : 0;

  const precision = hasTranscript
    ? round3(
        clamp(
          surface.repairMarkerCount <= 1
            ? 0.7
            : surface.repairMarkerCount <= 3
              ? 0.5
              : 0.35,
          0,
          1
        )
      )
    : 0;

  const repairLanguage = hasTranscript
    ? round3(clamp(surface.repairMarkerCount / 8, 0, 1))
    : 0;

  const notes = (field: string, status: string): string =>
    `${field}: ${status}`;

  return {
    vocabulary: {
      score: vocabulary,
      notes: hasTranscript
        ? `type-token ratio ${surface.uniqueTokenRatio} (raw surface metric, DERIVED)`
        : notes("vocabulary", "NOT_OBSERVED — no transcript"),
    },
    grammar: {
      score: grammar,
      notes:
        "NOT_OBSERVED — morphological grammar scoring requires a linguistic lens (INSUFFICIENT without POS analysis)",
    },
    structure: {
      score: structure,
      notes: hasTranscript
        ? `discourse marker density ${surface.discourseMarkerDensity}/sentence (DERIVED)`
        : notes("structure", "NOT_OBSERVED — no transcript"),
    },
    coherence: {
      score: coherence,
      notes: hasTranscript
        ? `connectivity ${connectivityBase}` +
          (intelligibilitySignal
            ? ` + signal intelligibility ${normaliseScoreLike(typeof intelligibilitySignal.value === "number" ? intelligibilitySignal.value : 0)}`
            : " (no intelligibility signal)")
        : notes("coherence", "NOT_OBSERVED — no transcript or signal"),
    },
    complexity: {
      score: complexity,
      notes: hasTranscript
        ? `avg sentence length ${surface.averageSentenceWords} words → normalised 0–1 (DERIVED)`
        : notes("complexity", "NOT_OBSERVED — no transcript"),
    },
    precision: {
      score: precision,
      notes: hasTranscript
        ? `repair monitoring proxy: ${surface.repairMarkerCount} markers (active monitoring noted, DERIVED/inferred)`
        : notes("precision", "NOT_OBSERVED — no transcript"),
    },
    fluency: {
      score: fluency,
      notes:
        hasTranscript
          ? `speech rate ${(surface.tokenCount / (surface.averageSentenceWords * surface.sentenceCount || 1) * 60).toFixed(0)} wpm, filler ratio ${surface.fillerRatio} (DERIVED)`
          : notes("fluency", "NOT_OBSERVED — no timing or transcript"),
    },
    repair_language: {
      score: repairLanguage,
      notes: hasTranscript
        ? `${surface.repairMarkerCount} repair markers / ${surface.tokenCount} tokens (DERIVED)`
        : notes("repair_language", "NOT_OBSERVED — no transcript"),
    },
  };
}

// ─── Communication analysis block (deterministic) ───────────────────────────

function produceCommunicationAnalysis(
  question: QuestionDefinition,
  context: Partial<CommunicationAnalysisContext>,
  surface: SurfaceMetrics,
  telemetryEvidence: Array<{
    dimension: CanonicalTelemetryDimension;
    score: number;
  }>,
  signals: AtomicAudioSignal[],
  hasTranscript: boolean
): CommunicationAnalysisObject["communication_analysis"] {
  const telemetryByDim = new Map(
    telemetryEvidence.map((e) => [e.dimension, e.score])
  );

  const receiverFit = (() => {
    const isRelevant =
      question.contract.constructs.some(
        (c) =>
          c === "audience_adaptation" ||
          c === "context_fit" ||
          c === "stakeholder_calibration"
      ) || Boolean(context.receiver || context.hierarchy);
    if (!isRelevant) {
      return 0;
    }
    return round3(
      clamp(
        0.45 +
          (telemetryByDim.get("Adaptive Shifting") ?? 0) * 0.3 +
          (telemetryByDim.get("Hierarchy Sensitivity") ?? 0) * 0.15 +
          (hasTranscript ? 0.1 : 0),
        0,
        1
      )
    );
  })();

  const hierarchyFit = (() => {
    const isRelevant =
      Boolean(context.hierarchy) ||
      question.contract.constructs.includes("stakeholder_calibration") ||
      question.contract.constructs.includes("decision_quality");
    if (!isRelevant) return 0;
    return round3(
      clamp(
        0.4 +
          (telemetryByDim.get("Hierarchy Sensitivity") ?? 0) * 0.4 +
          (telemetryByDim.get("Adaptive Shifting") ?? 0) * 0.2,
        0,
        1
      )
    );
  })();

  const tone = (() => {
    const pitchSignal = signals.find((s) => s.signal_type === "pitch_energy");
    if (!pitchSignal) return "";
    return round3(
      normaliseScoreLike(
        typeof pitchSignal.value === "number" ? pitchSignal.value : 0
      )
    ).toString();
  })();

  const turnTaking = (() => {
    const turnSignal = signals.find(
      (s) => s.signal_type === "turn_switch_latency"
    );
    if (!turnSignal) return 0;
    return round3(
      normaliseScoreLike(
        typeof turnSignal.value === "number" ? turnSignal.value : 0
      )
    );
  })();

  const clarification = round3(
    clamp(surface.clarificationMarkerCount / 3, 0, 1)
  );

  const semanticContinuity = round3(
    clamp(
      (telemetryByDim.get("Semantic Continuity") ?? 0.5) * 0.7 +
        (hasTranscript ? surface.discourseMarkerDensity * 0.3 : 0),
      0,
      1
    )
  );

  const contextTransfer = (() => {
    const isPerturbConfirm =
      question.stage === "PERTURB" || question.stage === "CONFIRM";
    return round3(
      isPerturbConfirm
        ? clamp(
            0.55 +
              (telemetryByDim.get("Adaptive Shifting") ?? 0) * 0.3 +
              (surface.hedgeMarkerCount >= 1 ? 0.05 : 0),
            0,
            1
          )
        : 0
    );
  })();

  return {
    receiver_fit: receiverFit,
    hierarchy_fit: hierarchyFit,
    tone,
    turn_taking: turnTaking,
    clarification,
    semantic_continuity: semanticContinuity,
    context_transfer: contextTransfer,
  };
}

// ─── Observability array builder ─────────────────────────────────────────────

interface ObservabilityEntry {
  dimension: string;
  evidence_status: EvidenceStatus;
  source: string;
  directness: EvidenceAuthority;
  confidence: number;
}

function buildObservability(
  telemetryEvidence: Array<{
    dimension: CanonicalTelemetryDimension;
    confidence: number;
    evidenceStatus: EvidenceStatus;
    directness: EvidenceAuthority;
  }>,
  hasTranscript: boolean,
  assistanceStatus: string,
  asrConfidence: number
): ObservabilityEntry[] {
  const entries: ObservabilityEntry[] = [];

  for (const dim of TELEMETRY_12D) {
    const found = telemetryEvidence.find((e) => e.dimension === dim);
    if (found) {
      entries.push({
        dimension: dim,
        evidence_status: found.evidenceStatus,
        source: `signal:${dim.toLowerCase().replace(/\s+/g, "_")}`,
        directness: found.directness,
        confidence: found.confidence,
      });
    } else if (hasTranscript) {
      entries.push({
        dimension: dim,
        evidence_status: "INSUFFICIENT",
        source: "transcript_derived:unavailable",
        directness: "UNOBSERVED",
        confidence: 0,
      });
    } else {
      entries.push({
        dimension: dim,
        evidence_status: "NOT_OBSERVED",
        source: "no_transcript_no_signal",
        directness: "UNOBSERVED",
        confidence: 0,
      });
    }
  }

  const linguisticDims = [
    "vocabulary",
    "grammar",
    "structure",
    "coherence",
    "complexity",
    "precision",
    "fluency",
    "repair_language",
  ];
  for (const dim of linguisticDims) {
    const measured = hasTranscript && dim !== "grammar";
    entries.push({
      dimension: `linguistic.${dim}`,
      evidence_status: measured ? "OBSERVED" : "NOT_OBSERVED",
      source: measured ? `surface:${dim}` : "no_transcript",
      directness: measured ? "DERIVED" : "UNOBSERVED",
      confidence: measured ? 0.3 : 0,
    });
  }

  if (assistanceStatus !== "none") {
    entries.push({
      dimension: "confound.assistance",
      evidence_status: "OBSERVED",
      source: `response.assistance_status=${assistanceStatus}`,
      directness: "DIRECT",
      confidence: 0.9,
    });
  }

  if (asrConfidence < 0.6) {
    entries.push({
      dimension: "confound.asr_confidence",
      evidence_status: "OBSERVED",
      source: `transcript.asr_confidence=${asrConfidence}`,
      directness: "DIRECT",
      confidence: 0.9,
    });
  }

  return entries;
}

// ─── lp18_evidence builder ──────────────────────────────────────────────────

interface Lp18EvidenceEntry {
  capability_address: string;
  response_contribution: number;
  state_candidates: string[];
  confidence: number;
  evidence_ids: string[];
}

function buildLp18Evidence(
  question: QuestionDefinition,
  telemetryEvidence: Array<{
    dimension: CanonicalTelemetryDimension;
    score: number;
    confidence: number;
  }>,
  surface: SurfaceMetrics,
  _signals: AtomicAudioSignal[],
  responseId: string,
  hasTranscript: boolean
): Lp18EvidenceEntry[] {
  const caps = new Map<string, ConstructMapping>();
  for (const construct of question.contract.constructs) {
    const mapping = CONSTRUCT_CAPABILITY_MAP[construct];
    if (mapping) {
      caps.set(mapping.address, mapping);
    }
  }

  if (caps.size === 0) {
    caps.set("task.task_management", {
      cap: "INT",
      address: "task.task_management",
      telemetry: ["Cognitive Load Alignment", "Semantic Continuity"],
    });
  }

  const signalDims = new Map(
    telemetryEvidence.map((e) => [e.dimension, e])
  );

  const entries: Lp18EvidenceEntry[] = [];

  for (const [address, mapping] of caps) {
    const engagedScores = mapping.telemetry
      .map((dim) => signalDims.get(dim)?.score ?? 0)
      .filter((s) => s > 0);

    const avgEngaged =
      engagedScores.length > 0
        ? engagedScores.reduce((a, b) => a + b, 0) / engagedScores.length
        : 0;

    const dataQualityBonus =
      (hasTranscript ? 0.1 : 0) + (_signals.length > 0 ? 0.1 : 0);
    const contentBase = surface.hasContent ? 0.15 : 0;

    const responseContribution = round3(
      clamp(0.2 + avgEngaged * 0.55 + contentBase + dataQualityBonus, 0, 1)
    );

    const avgConfidence =
      engagedScores.length > 0
        ? round3(
            mapping.telemetry
              .map((dim) => signalDims.get(dim)?.confidence ?? 0)
              .reduce((a, b) => a + b, 0) / mapping.telemetry.length
          )
        : 0.15;

    entries.push({
      capability_address: address,
      response_contribution: responseContribution,
      state_candidates: [],
      confidence: avgConfidence,
      evidence_ids: [responseId],
    });
  }

  return entries;
}

// ─── Interpretation block (deterministic) ───────────────────────────────────

function produceInterpretation(
  question: QuestionDefinition,
  surface: SurfaceMetrics,
  signals: AtomicAudioSignal[],
  telemetryEvidence: Array<{
    dimension: CanonicalTelemetryDimension;
    score: number;
    confidence: number;
    directness: EvidenceAuthority;
  }>,
  hasTranscript: boolean,
  assistanceStatus: string,
  durationSec: number,
  sessionContext: Partial<CommunicationAnalysisContext>
): CommunicationAnalysisObject["interpretation"] {
  const competingExplanations: string[] = [];
  const counterEvidence: string[] = [];

  if (signals.length === 1) {
    competingExplanations.push(
      `Only one audio signal available (single observation — rule: ${CANONICAL_DO_NOT_INFER})`
    );
  }
  if (signals.length === 0 && hasTranscript) {
    competingExplanations.push(
      "Client browser transcript only — no server-side audio signals to triangulate; error/source confound"
    );
  }
  if (!hasTranscript && signals.length === 0) {
    competingExplanations.push(
      "No transcript and no audio signals — content is not observable; abstention required"
    );
  }

  if (assistanceStatus !== "none") {
    competingExplanations.push(
      `Assistance status = '${assistanceStatus}' — partial/full assistance confounds authentic capability signal`
    );
  }

  if (durationSec > 0) {
    const wpm =
      surface.tokenCount > 0
        ? (surface.tokenCount / durationSec) * 60
        : 0;
    if (wpm > 220) {
      competingExplanations.push(
        `Speaking rate ${wpm.toFixed(0)} wpm — unusually fast; may indicate scripted content or reading from notes`
      );
    }
  }

  if (surface.hedgeMarkerCount === 1) {
    competingExplanations.push(
      "One hedge phrase detected — insufficient to claim internal uncertainty without repetition"
    );
  }

  if (signals.length > 0) {
    const hasHighIntelligence = signals.some(
      (s) =>
        s.signal_type === "intelligibility" &&
        typeof s.value === "number" &&
        s.value >= 0.8
    );
    if (hasHighIntelligence) {
      counterEvidence.push(
        "High intelligibility signal observed — counters the hypothesis of low comprehensibility if other dims are weak"
      );
    }

    const hasLowLatency = signals.some(
      (s) =>
        s.signal_type === "latency" &&
        typeof s.value === "number" &&
        s.value < 500
    );
    if (hasLowLatency) {
      counterEvidence.push(
        "Low response latency observed — counters the hypothesis of processing overload"
      );
    }
  }

  if (surface.hasContent && surface.discourseMarkerDensity > 0.5) {
    counterEvidence.push(
      "High discourse marker density observed — counters the hypothesis of incoherent structure"
    );
  }

  const knowledgeHeavyConstructs = [
    "causal_reasoning",
    "decision_quality",
    "evidence_discipline",
    "context_fit",
    "stakeholder_calibration",
    "strategic_reasoning",
  ];
  const taskKnowledgeDependency =
    question.contract.constructs.some((c) =>
      knowledgeHeavyConstructs.includes(c)
    ) || Boolean(sessionContext.professionalDomain);

  const dimSummary = telemetryEvidence
    .filter((e) => e.score > 0)
    .map((e) => `${e.dimension}=${e.score}(${e.directness})`)
    .join("; ");
  const attribution = [
    `Engine: ${CAO_ENGINE_VERSION}`,
    `Question: ${question.question_id} (${question.stage})`,
    `Transcript: ${hasTranscript ? "present" : "absent"}`,
    `Signals: ${signals.length} (${signals.map((s) => s.signal_type).join(", ")})`,
    `Dims measured: ${dimSummary}`,
    taskKnowledgeDependency
      ? "Task: knowledge-dependent (domain/context/heavy reasoning constructs)"
      : "Task: meaning-recovery (adaptability/repair/light constructs)",
    competingExplanations.length > 0
      ? `Confound flags: ${competingExplanations.length}`
      : "No major confound flags",
  ].join(" | ");

  const observedCount = telemetryEvidence.filter(
    (e) => e.directness !== "UNOBSERVED"
  ).length;
  const abstentionState: "none" | "partial" | "full" =
    observedCount === 0 && !hasTranscript
      ? "full"
      : observedCount <= 2 || !hasTranscript
        ? "partial"
        : "none";

  return {
    competing_explanations: competingExplanations,
    counter_evidence: counterEvidence,
    task_knowledge_dependency: taskKnowledgeDependency,
    attribution,
    abstention_state: abstentionState,
  };
}

// ─── Main engine export ─────────────────────────────────────────────────────

/**
 * Analyse a single response and produce a governed CommunicationAnalysisObject.
 *
 * Every claim is deterministic, seeded from the canonical data banks, and
 * labelled with evidence_status / directness / confidence.  No network call,
 * no database write.
 */
export function analyzeCommunication(
  input: CommunicationAnalysisInput
): CommunicationAnalysisObject {
  const {
    response,
    transcript,
    signals,
    question,
    context,
    analysisId,
    interactionId,
    eventIds,
    ruleVersion,
  } = input;

  const hasTranscript = Boolean(transcript?.text?.trim());
  const text = (transcript?.text ?? "").trim();
  const durationSec = response.timing.duration_ms / 1000;

  const surface = computeSurfaceMetrics(text);

  const signalEvidence: DerivedTelemetryEntry[] = [];
  const seenDims = new Set<CanonicalTelemetryDimension>();

  for (const signal of signals) {
    const dimension = SIGNAL_TO_TELEMETRY[signal.signal_type];
    if (!dimension || seenDims.has(dimension)) continue;
    seenDims.add(dimension);

    const { score, confidence } = normaliseSignalValue(signal, durationSec);
    signalEvidence.push({
      dimension,
      score,
      confidence: round3(confidence),
      evidenceStatus: "OBSERVED",
      evidenceIds: [response.response_id, signal.signal_id],
      source: `signal:${signal.signal_type}`,
      directness: "DIRECT",
    });
  }

  const surfaceDerived = deriveSurfaceTelemetry(
    text,
    surface,
    response.response_id,
    transcript?.transcript_id
  );

  const mergedTelemetry = new Map<
    CanonicalTelemetryDimension,
    DerivedTelemetryEntry
  >();
  for (const entry of surfaceDerived) {
    if (!seenDims.has(entry.dimension)) {
      mergedTelemetry.set(entry.dimension, entry);
    }
  }
  for (const entry of signalEvidence) {
    mergedTelemetry.set(entry.dimension, entry);
  }

  const telemetryEvidence = Array.from(mergedTelemetry.values());

  const ctx: Partial<CommunicationAnalysisContext> = context ?? {};
  const channel = ctx.channel ?? "ai-voice";
  const languagePair = ctx.languagePair ?? "";

  const asrConfidence = transcript?.asr_confidence ?? 0;

  const observability = buildObservability(
    telemetryEvidence,
    hasTranscript,
    response.assistance_status,
    asrConfidence
  );

  const lp18Evidence = buildLp18Evidence(
    question,
    telemetryEvidence,
    surface,
    signals,
    response.response_id,
    hasTranscript
  );

  const contentAnalysis = produceContentAnalysis(question, text, surface);

  const linguisticAnalysis = produceLinguisticAnalysis(
    surface,
    signals,
    durationSec,
    hasTranscript
  );

  const communicationAnalysis = produceCommunicationAnalysis(
    question,
    ctx,
    surface,
    telemetryEvidence,
    signals,
    hasTranscript
  );

  const interpretation = produceInterpretation(
    question,
    surface,
    signals,
    telemetryEvidence,
    hasTranscript,
    response.assistance_status,
    durationSec,
    ctx
  );

  const modality: Modality = "speaking";
  const live =
    signals.some(
      (s) =>
        s.signal_type === "latency" || s.signal_type === "intelligibility"
    ) || hasTranscript;

  const analysisIdFinal =
    analysisId ?? `cao-${response.response_id}-${question.question_id}`;
  const interactionIdFinal =
    interactionId ?? `${response.assessment_id}:${question.question_id}`;
  const eventIdsFinal = eventIds ?? [];

  const rawEvidence: CommunicationAnalysisObject["raw_evidence"] = {
    audio_ref: response.audio_id,
    raw_transcript: text || "",
    raw_written_response: undefined,
    timing_ms: response.timing.duration_ms,
    device: `${response.device.browser}/${response.device.os}${response.device.is_mobile ? " (mobile)" : ""}`,
    channel,
  };

  const now = new Date().toISOString();

  const result: CommunicationAnalysisObject = {
    analysis_id: analysisIdFinal,
    response_id: response.response_id,
    interaction_id: interactionIdFinal,
    event_id: eventIdsFinal,
    question_id: question.question_id,
    assessment_id: response.assessment_id,
    schema_version: CAO_SCHEMA_VERSION,
    model_version: CAO_ENGINE_VERSION,
    rule_version: ruleVersion ?? CAO_RULE_VERSION,

    modality,
    live,

    raw_evidence: rawEvidence,

    content_analysis: contentAnalysis,
    linguistic_analysis: linguisticAnalysis,
    communication_analysis: communicationAnalysis,

    context: {
      receiver: ctx.receiver,
      relationship: ctx.relationship,
      hierarchy: ctx.hierarchy,
      professional_domain: ctx.professionalDomain,
      objective: ctx.objective,
      channel,
      culture: ctx.culture,
      language_pair: languagePair,
    },

    observability: observability.map((e) => ({
      dimension: e.dimension,
      evidence_status: e.evidence_status,
      source: e.source,
      directness: e.directness,
      confidence: e.confidence,
    })),

    lp18_evidence: lp18Evidence.map((e) => ({
      capability_address: e.capability_address,
      response_contribution: e.response_contribution,
      state_candidates: e.state_candidates,
      confidence: e.confidence,
      evidence_ids: e.evidence_ids,
    })),

    telemetry_evidence: telemetryEvidence.map((e) => ({
      dimension: e.dimension,
      score: e.score,
      confidence: e.confidence,
      evidence_status: e.evidenceStatus,
      evidence_ids: e.evidenceIds,
    })),

    interpretation,

    created_at: now,
  };

  return result;
}
