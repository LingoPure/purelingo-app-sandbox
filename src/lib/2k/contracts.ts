/**
 * LingoPure 2K — Cross-boundary data contracts (Phase 0, ISS-001 to ISS-008)
 *
 * These types are the frozen boundary objects between every 2K component.
 * Internal implementation may change; these contracts must not drift.
 *
 * Source: CEFR Commercial Implementation Master, §5
 * Frozen: 2026-09-11
 */

// ─── Enums and shared value types ───────────────────────────────────────────

export type AssessmentStatus =
  | "CREATED"
  | "IN_PROGRESS"
  | "RESPONSES_COMPLETE"
  | "TRANSCRIBING"
  | "ANALYSING"
  | "ADJUDICATING"
  | "RESOLVING_STATE"
  | "DIAGNOSING"
  | "RECOMMENDING"
  | "FREEZING"
  | "COMPLETE"
  | "FAILED"
  | "RETRYING";

export type QuestionStage = "LOCATE" | "BOUND" | "RESOLVE" | "PERTURB" | "CONFIRM";

export type Modality = "speaking" | "writing" | "listening" | "reading" | "interaction" | "simulation";

export type EvidenceStatus = "OBSERVED" | "NOT_OBSERVED" | "NOT_APPLICABLE" | "INSUFFICIENT" | "CONFLICTED" | "ZERO";

/**
 * Grade of evidential directness (§6.1 taxonomy — amended from §5 draft
 * which omitted PARTIAL, TRIANGULATED and UNOBSERVED and conflated
 * abstention into the authority grade).
 *
 *   DIRECT       — directly observed (acoustic/writing-process + transcript)
 *   PARTIAL      — direct but partial (e.g. audio without usable transcript)
 *   DERIVED      — derived from canonical telemetry + current model rules
 *   INFERRED     — indirect inference from surrounding evidence
 *   TRIANGULATED — at least two independent sources agree
 *   UNOBSERVED   — not present in the evidentiary pool (no observation)
 */
export type EvidenceAuthority = "DIRECT" | "PARTIAL" | "DERIVED" | "INFERRED" | "TRIANGULATED" | "UNOBSERVED";

export type ConfoundLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProcessingStage =
  | "INGESTION"
  | "TRANSCRIPTION"
  | "AUDIO_SIGNALS"
  | "COMMUNICATION_ANALYSIS"
  | "EVIDENCE_GOVERNANCE"
  | "ADJUDICATION"
  | "STATE_RESOLUTION"
  | "TELEMETRY"
  | "LP1000"
  | "DIAGNOSIS"
  | "RECOMMENDATION"
  | "FREEZE"
  | "COMPLETE";

// ─── Closed domain unions (Phase 0 freeze — close open strings) ─────────────

/** Canonical six CEFR macro bands (score_bands.json LP1000 bands). */
export type CefrMacroBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** Recommendation action families — A through J (J = progression control). */
export type RecommendationFamily =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

/** Canonical diagnostic archetype taxonomy (seeded 10 — lp_rec_db.json arch field). */
export type DiagnosticArchetype =
  | "CAPABILITY"
  | "AUTOMATICITY"
  | "TRANSFER"
  | "CONTRADICTION_CONFLICT"
  | "COGNITIVE_OVERLOAD"
  | "HIERARCHY_PRESSURE"
  | "SEMANTIC_DRIFT"
  | "CONTEXT"
  | "PROGRESSION_READY"
  | "DO_NOT_TRAIN";

/** LP-1000 score band names (from score_bands.json LP1000_BAND field). */
export type Lp1000Band =
  | "Survival"
  | "Functional"
  | "Professional"
  | "Stable Professional"
  | "Executive Stability"
  | "Strategic Mastery";

// ─── C01/ISS-001: AssessmentSession ────────────────────────────────────────

export interface AssessmentSession {
  assessment_id: string;           // UUID — immutable
  learner_id: string;              // references students.id
  lead_id?: string;                // for pre-signup learners
  session_id: string;              // browser/device session
  language: string;                // e.g. "vi-VN", "en-US"
  question_bank_version: string;   // versioned question bank ref
  context: {
    role?: string;                 // "student", "professional", etc.
    goal?: string;                 // learning goal from onboarding
    domain?: string;               // professional domain if applicable
  };
  consent: {
    audio_recording: boolean;
    data_processing: boolean;
    recorded_at: string;           // ISO 8601
  };
  status: AssessmentStatus;
  processing_stage?: ProcessingStage;
  processing_error?: string;       // last failure message
  processing_retries: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ─── C02/ISS-002: ResponseObject ───────────────────────────────────────────

export interface ResponseObject {
  response_id: string;             // UUID — immutable
  assessment_id: string;
  question_id: string;             // e.g. "Q1", "Q14"
  stage: QuestionStage;            // LOCATE/BOUND/RESOLVE/PERTURB/CONFIRM
  task: string;                    // question text shown to learner
  receiver?: string;               // who the learner is speaking to
  context?: string;                // scenario context
  audio_id?: string;               // reference to stored audio
  client_transcript?: string;      // browser STT if available
  timing: {
    started_at: string;
    ended_at: string;
    duration_ms: number;
  };
  device: {
    browser: string;
    os: string;
    is_mobile: boolean;
  };
  assistance_status: "none" | "partial" | "full";
  upload_status: "pending" | "uploaded" | "failed";
  processing_status: "pending" | "processing" | "complete" | "failed";
  created_at: string;
}

// ─── C03/ISS-003: TranscriptObject ─────────────────────────────────────────

export interface TranscriptObject {
  transcript_id: string;           // UUID — immutable
  response_id: string;
  version: number;                 // versioned — never overwrite, append
  text: string;
  language: string;
  timestamps?: Array<{
    word: string;
    start_ms: number;
    end_ms: number;
  }>;
  asr_provider: string;           // "browser-stt" | "openai-whisper"
  asr_version: string;
  asr_confidence: number;          // 0–1
  created_at: string;
}

// ─── C04/ISS-004: AtomicAudioSignals ───────────────────────────────────────

export interface AtomicAudioSignal {
  signal_id: string;               // UUID — immutable
  response_id: string;
  signal_type: string;             // "latency" | "pause_count" | "pitch_energy" | "repair_timing" | "intelligibility" | etc.
  value: number | null;            // null = NOT_OBSERVED (single source of truth)
  unit: string;                    // "ms" | "count" | "dB" | "ratio" | "score"
  confidence: number;              // 0–1
  measurement_method: string;      // "browser-api" | "whisper-derived" | "manual"
  measurement_version: string;
  created_at: string;
}

/** Explicit guard — replaces the dropped `.observed` boolean. */
export function isObservedSignal(signal: AtomicAudioSignal): boolean {
  return signal.value !== null;
}

// ─── C05/ISS-005: CommunicationAnalysisObject ──────────────────────────────

export interface CommunicationAnalysisObject {
  analysis_id: string;             // UUID — immutable
  response_id: string;
  interaction_id: string;
  event_id: string[];
  question_id: string;
  assessment_id: string;
  schema_version: string;
  model_version: string;
  rule_version: string;

  modality: Modality;
  live: boolean;                   // true = human speech, false = AI-assisted

  raw_evidence: {
    audio_ref?: string;
    raw_transcript: string;
    raw_written_response?: string;
    timing_ms: number;
    device: string;
    channel: string;
  };

  content_analysis: {
    intent: string;
    meaning: string;
    key_information: string[];
    task_fulfilment: number;       // 0–1
    omissions: string[];
    ambiguity: string[];
    contradictions: string[];
  };

  linguistic_analysis: {
    vocabulary: { score: number; notes: string };
    grammar: { score: number; notes: string };
    structure: { score: number; notes: string };
    coherence: { score: number; notes: string };
    complexity: { score: number; notes: string };
    precision: { score: number; notes: string };
    fluency: { score: number; notes: string };
    repair_language: { score: number; notes: string };
  };

  communication_analysis: {
    receiver_fit: number;          // 0–1
    hierarchy_fit: number;         // 0–1
    tone: string;
    turn_taking: number;           // 0–1
    clarification: number;        // 0–1
    semantic_continuity: number;   // 0–1
    context_transfer: number;      // 0–1
  };

  context: {
    receiver?: string;
    relationship?: string;
    hierarchy?: string;
    professional_domain?: string;
    objective?: string;
    channel: string;
    culture?: string;
    language_pair: string;
  };

  observability: Array<{
    dimension: string;
    evidence_status: EvidenceStatus;
    source: string;
    directness: EvidenceAuthority;
    confidence: number;
  }>;

  lp18_evidence: Array<{
    capability_address: string;
    response_contribution: number;
    state_candidates: string[];
    confidence: number;
    evidence_ids: string[];
  }>;

  telemetry_evidence: Array<{
    dimension: string;
    score?: number;
    confidence: number;
    evidence_status: EvidenceStatus;
    evidence_ids: string[];
  }>;

  interpretation: {
    competing_explanations: string[];
    counter_evidence: string[];
    task_knowledge_dependency: boolean;
    attribution: string;
    abstention_state: "none" | "partial" | "full";
  };

  created_at: string;
}

// ─── C06/ISS-006: EvidenceObject ───────────────────────────────────────────

export interface EvidenceObject {
  evidence_id: string;             // UUID — immutable
  construct: string;               // capability address (e.g. "speaking.fluency")
  observation: string;             // what was observed
  status: EvidenceStatus;
  authority: EvidenceAuthority;
  source: {
    modality: Modality;
    response_id: string;
    analysis_id: string;
    signal_ids: string[];
  };
  provenance: {
    engine_version: string;
    rule_version?: string;
    created_at: string;
  };
  independence: "independent" | "correlated" | "dependent";
  quality: number;                 // 0–1
  task_relevance: number;          // 0–1
  context_receiver: {
    receiver?: string;
    context?: string;
  };
  confounds: ConfoundLevel;
  confound_notes?: string[];
  counter_evidence: string[];      // evidence_ids that contradict this
  confidence: number;              // 0–1
  created_at: string;
}

// ─── C07/ISS-007: CanonicalAssessmentResult ───────────────────────────────

export interface CanonicalAssessmentResult {
  result_id: string;               // UUID — immutable, frozen
  assessment_id: string;
  learner_id: string;

  coverage: {
    total_questions: number;
    answered: number;
    with_audio: number;
    with_transcript: number;
    not_observed: number;
    coverage_pct: number;
  };

  lp18: {
    working: LP18WorkingState;
    stable: LP18StableState;
  };

  capabilities: Array<{
    address: string;
    level: CefrMacroBand;
    confidence: number;
  }>;

  lp1000: {
    score: number;
    band: Lp1000Band;
    confidence: number;
    components: Record<string, number>;
  };

  telemetry: {
    dimensions: Array<{
      name: string;
      score: number;
      confidence: number;
    }>;
    drift: number;
    convergence: number;
  };

  confidence: number;
  contradictions: Array<{
    evidence_ids: string[];
    description: string;
    severity: "low" | "medium" | "high";
  }>;

  diagnosis: {
    archetype: DiagnosticArchetype;
    gap_origin: string;
    confidence: number;
  };

  recommendation: {
    family: RecommendationFamily;
    intervention_id?: string;
    priority: number;
    exposure: string;
    next_probe?: string;
  };

  evidence_summary: {
    total_evidence: number;
    accepted: number;
    rejected: number;
    downweighted: number;
  };

  architecture: {
    brain_version: string;
    ontology_version: string;
    bank_version: string;
    rules_version: string;
    question_version: string;
    asr_version?: string;
    evidence_version: string;
    lens_version: string;
    report_version: string;
  };

  frozen_at: string;               // ISO 8601 — immutable after freeze
  lineage: {
    assessment_id: string;
    session_id: string;
    response_ids: string[];
    analysis_ids: string[];
    evidence_ids: string[];
    engine_versions: Record<string, string>;
  };
}

// ─── Supporting state types ─────────────────────────────────────────────────

export interface LP18WorkingState {
  micro_levels: Array<{
    level: number;                 // 1–18
    capability: string;
    evidence_count: number;
    confidence: number;
    coverage: number;
    last_observed: string;
  }>;
  overall_confidence: number;
  overall_coverage: number;
}

export interface LP18StableState {
  micro_levels: Array<{
    level: number;
    capability: string;
    certified_level: string;
    certified_at: string;
    transition_count: number;
  }>;
  cefr_macro: CefrMacroBand;
  hysteresis_qualified: boolean;
}

// ─── C08/ISS-008: LessonOutcome ────────────────────────────────────────────

export interface LessonOutcome {
  outcome_id: string;              // UUID — immutable
  learner_id: string;
  result_id: string;               // links to CanonicalAssessmentResult
  intervention_id?: string;        // which A-J intervention was applied
  teacher_action: string;          // what the teacher did
  exposure: string;                // time/focus/technique
  learner_response: string;        // how the learner responded
  teacher_observation: string;     // teacher's assessment
  artifacts: string[];             // notes, recordings, screenshots
  confounds: ConfoundLevel;
  confound_notes?: string[];
  outcome_status: "positive" | "neutral" | "negative" | "inconclusive";
  next_action?: string;
  created_at: string;
}
