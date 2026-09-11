/**
 * LingoPure 2K — Minimum API contract + processing state machine (Phase 0, ISS-009)
 *
 * Derived from the CEFR Commercial Implementation closed circuit (C01–C22) and the
 * Web v6 canonical API contract (§14). These types are the frozen boundary between
 * HTTP and the 2K pipeline. Internal implementation may change; this contract must not.
 *
 * DEPENDENCY: imports the eight frozen data contracts from ./contracts.ts. It never
 * re-declares them — where this file needs a closed union the contracts leave open
 * (capabilities level, recommendation family), it exports a derived union here rather
 * than mutating the frozen file.
 *
 * Source: LingoPure_Technology_Dan_Docs — Web v6 master framework §14 (canonical API)
 *         + CEFR Commercial Implementation Master §6 (12-endpoint minimum)
 * Frozen: 2026-09-11
 */

import type {
  AssessmentSession,
  AssessmentStatus,
  CanonicalAssessmentResult,
  LessonOutcome,
  LP18StableState,
  LP18WorkingState,
  ProcessingStage,
  QuestionStage,
  ResponseObject,
} from "./contracts";

// ─── Derived closed unions (contract deltas; do not edit contracts.ts) ──────

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** A–I canonical families + J (probe/hold control when unsafe or uncertain). */
export type RecommendationFamily = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type HttpMethod = "GET" | "POST";

/** Stage-level progress for GET /assessments/{id}. */
export type AssessmentProgress = {
  total_questions: number;
  answered: number;
  with_audio: number;
  with_transcript: number;
  coverage_pct: number;
};

export type AssessmentQuestion = {
  question_id: string;
  sequence: number;
  stage: QuestionStage;
  task: string;
  receiver?: string;
  context?: string;
};

/**
 * The observability event that backs `CommunicationAnalysisObject.event_id` and
 * the /status ledger. This is the missing boundary object called out in the
 * Phase 0 contract review — a persisted, append-only record of every state/stage
 * change on an assessment.
 */
export interface ProcessingEventObject {
  event_id: string;               // UUID — immutable
  assessment_id: string;
  occurred_at: string;            // ISO 8601
  from_status?: AssessmentStatus;
  to_status: AssessmentStatus;
  from_stage?: ProcessingStage;
  to_stage?: ProcessingStage;
  action: string;                 // machine key e.g. "response_ingested", "stage_advanced"
  detail: Record<string, unknown>;
  terminal: boolean;
}

// ─── Endpoint request types ────────────────────────────────────────────────
// Canonical 12 from CEFR Commercial Implementation Master §6.

/** #1 POST /assessments */
export interface CreateAssessmentRequest {
  learner_id: string;
  session_id: string;
  language: string;
  question_bank_version: string;
  context: {
    role?: string;
    goal?: string;
    domain?: string;
  };
  consent: {
    audio_recording: boolean;
    data_processing: boolean;
  };
}

/** #2 GET /assessments/{id} — no request body. */

/** #3 POST /assessments/{id}/responses */
export interface IngestResponseRequest {
  response: {
    response_id: string;            // client-generated — idempotency key
    question_id: string;
    stage: QuestionStage;
    task: string;
    receiver?: string;
    context?: string;
    client_transcript?: string;
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
  };
}

/** #4 POST /responses/{id}/audio — multipart upload or register. */
export interface UploadAudioRequest {
  content_type: string;
  duration_ms: number;
  size_bytes: number;
}

/** #5 GET /responses/{id}/processing — no request body. */

/** #6 POST /assessments/{id}/evaluate */
export interface EvaluateRequest {
  reason?: string;
}

/** #7 GET /assessments/{id}/result — no request body. */

/** #8 GET /assessments/{id}/report?type=learner|teacher */
export interface GetReportRequest {
  type: "learner" | "teacher";
}

/** #9 GET /learners/{id}/state — no request body. */

/** #10 GET /learners/{id}/history — no request body. */

/** #11 POST /interventions */
export interface CreateInterventionRequest {
  result_id: string;
  family: string;                 // RecommendationFamily
  learner_id: string;
  priority: number;
  exposure: string;
  next_probe?: string;
}

/** #12 POST /interventions/{id}/outcome */
export interface CaptureOutcomeRequest {
  result_id: string;
  intervention_id?: string;
  teacher_action: string;
  exposure: string;
  learner_response: string;
  teacher_observation: string;
  artifacts: string[];
  outcome_status: "positive" | "neutral" | "negative" | "inconclusive";
  next_action?: string;
}

// ─── Endpoint response types ─────────────────────────────────────────────

/** #1 POST /assessments */
export interface CreateAssessmentResponse {
  assessment: AssessmentSession;
}

/** #2 GET /assessments/{id} */
export interface GetAssessmentResponse {
  assessment: AssessmentSession;
  progress: AssessmentProgress;
}

/** #3 POST /assessments/{id}/responses */
export interface IngestResponseResponse {
  response: ResponseObject;
}

/** #4 POST /responses/{id}/audio */
export interface UploadAudioResponse {
  audio_id: string;
  storage_path: string;
  checksum: string;               // sha256 of uploaded bytes
}

/** #5 GET /responses/{id}/processing */
export interface GetResponseProcessingResponse {
  assessment_id: string;
  status: AssessmentStatus;
  processing_stage?: ProcessingStage;
  processing_error?: string;
  processing_retries: number;
  terminal: boolean;
  can_retry: boolean;
  last_events: ProcessingEventObject[];
}

/** #6 POST /assessments/{id}/evaluate */
export interface EvaluateResponse {
  assessment: AssessmentSession;  // RESPONSES_COMPLETE — pipeline enqueued
}

/** #7 GET /assessments/{id}/result */
export interface GetResultResponse {
  result: CanonicalAssessmentResult;
}

/** #8 GET /assessments/{id}/report */
export interface GetReportResponse {
  result: CanonicalAssessmentResult;
  type: "learner" | "teacher";
}

/** #9 GET /learners/{id}/state */
export interface GetLearnerStateResponse {
  working: LP18WorkingState;
  stable: LP18StableState;
  cefr_macro: string;
}

/** #10 GET /learners/{id}/history */
export interface GetLearnerHistoryResponse {
  results: CanonicalAssessmentResult[];
}

/** #11 POST /interventions */
export interface CreateInterventionResponse {
  intervention_id: string;
  family: string;
  learner_id: string;
}

/** #12 POST /interventions/{id}/outcome */
export interface CaptureOutcomeResponse {
  outcome: LessonOutcome;
}

// ─── Endpoint registry (canonical 12 from §6) ─────────────────────────────

export interface EndpointSpec {
  method: HttpMethod;
  /** Path template with :params, e.g. "/api/2k/assessments/:assessmentId". */
  path: string;
  idempotent: boolean;
}

export const ENDPOINTS: readonly EndpointSpec[] = [
  { method: "POST", path: "/api/2k/assessments", idempotent: false },
  { method: "GET", path: "/api/2k/assessments/:assessmentId", idempotent: false },
  { method: "POST", path: "/api/2k/assessments/:assessmentId/responses", idempotent: true },
  { method: "POST", path: "/api/2k/responses/:responseId/audio", idempotent: true },
  { method: "GET", path: "/api/2k/responses/:responseId/processing", idempotent: false },
  { method: "POST", path: "/api/2k/assessments/:assessmentId/evaluate", idempotent: false },
  { method: "GET", path: "/api/2k/assessments/:assessmentId/result", idempotent: false },
  { method: "GET", path: "/api/2k/assessments/:assessmentId/report", idempotent: false },
  { method: "GET", path: "/api/2k/learners/:learnerId/state", idempotent: false },
  { method: "GET", path: "/api/2k/learners/:learnerId/history", idempotent: false },
  { method: "POST", path: "/api/2k/interventions", idempotent: false },
  { method: "POST", path: "/api/2k/interventions/:interventionId/outcome", idempotent: false },
] as const;

// ─── Processing state machine ──────────────────────────────────────────────

export const MAX_PROCESSING_RETRIES = 3;

/** Statuses that can never leave the machine. */
export const TERMINAL_STATUSES: readonly AssessmentStatus[] = ["COMPLETE"] as const;

/** Statuses that require operator retry to re-enter the pipeline. */
export const FAILURE_STATUSES: readonly AssessmentStatus[] = ["FAILED"] as const;

/**
 * Single source of truth for the coarse status machine.
 * Self-loops are explicit where the lifecycle permits staying in a status
 * (e.g. IN_PROGRESS → IN_PROGRESS on resume/recovery; RESPONSES_COMPLETE is not
 * permitted to self-loop — re-uploading a response asks the server, not the client).
 */
export const ASSESSMENT_STATUS_TRANSITIONS: Record<AssessmentStatus, readonly AssessmentStatus[]> = {
  CREATED: ["IN_PROGRESS", "FAILED"],
  IN_PROGRESS: ["IN_PROGRESS", "RESPONSES_COMPLETE", "FAILED"],
  RESPONSES_COMPLETE: ["TRANSCRIBING", "FAILED", "RETRYING"],
  TRANSCRIBING: ["ANALYSING", "FAILED", "RETRYING"],
  ANALYSING: ["ADJUDICATING", "FAILED", "RETRYING"],
  ADJUDICATING: ["RESOLVING_STATE", "FAILED", "RETRYING"],
  RESOLVING_STATE: ["DIAGNOSING", "FAILED", "RETRYING"],
  DIAGNOSING: ["RECOMMENDING", "FAILED", "RETRYING"],
  RECOMMENDING: ["FREEZING", "FAILED", "RETRYING"],
  FREEZING: ["COMPLETE", "FAILED", "RETRYING"],
  COMPLETE: [],
  FAILED: ["RETRYING"],
  RETRYING: ["RESPONSES_COMPLETE", "TRANSCRIBING", "ANALYSING", "ADJUDICATING", "RESOLVING_STATE", "DIAGNOSING", "RECOMMENDING", "FREEZING"],
};

/**
 * The strict pipeline order. Stages can only advance forward through this list;
 * a failed stage re-enters at the status boundary it failed from, not mid-queue.
 */
export const PROCESSING_STAGE_ORDER: readonly ProcessingStage[] = [
  "INGESTION",
  "TRANSCRIPTION",
  "AUDIO_SIGNALS",
  "COMMUNICATION_ANALYSIS",
  "EVIDENCE_GOVERNANCE",
  "ADJUDICATION",
  "STATE_RESOLUTION",
  "TELEMETRY",
  "LP1000",
  "DIAGNOSIS",
  "RECOMMENDATION",
  "FREEZE",
  "COMPLETE",
] as const;

/** The fine-grained stages a status may be in while it owns the machine. */
export const PIPELINE_SUBSEQUENCE: Partial<Record<AssessmentStatus, readonly ProcessingStage[]>> = {
  RESPONSES_COMPLETE: ["INGESTION"],
  TRANSCRIBING: ["TRANSCRIPTION"],
  ANALYSING: ["AUDIO_SIGNALS", "COMMUNICATION_ANALYSIS"],
  ADJUDICATING: ["EVIDENCE_GOVERNANCE", "ADJUDICATION"],
  RESOLVING_STATE: ["STATE_RESOLUTION", "TELEMETRY", "LP1000"],
  DIAGNOSING: ["DIAGNOSIS"],
  RECOMMENDING: ["RECOMMENDATION"],
  FREEZING: ["FREEZE"],
  COMPLETE: ["COMPLETE"],
};

/** Statuses that are in the automated pipeline at all (no client interaction). */
export const PIPELINE_STATUSES: readonly AssessmentStatus[] = [
  "RESPONSES_COMPLETE",
  "TRANSCRIBING",
  "ANALYSING",
  "ADJUDICATING",
  "RESOLVING_STATE",
  "DIAGNOSING",
  "RECOMMENDING",
  "FREEZING",
] as const;

// ─── State machine helpers (pure, replayable) ───────────────────────────────

export function canTransition(from: AssessmentStatus, to: AssessmentStatus): boolean {
  return ASSESSMENT_STATUS_TRANSITIONS[from].includes(to);
}

/** The header status that owns a given pipeline stage (null when not yet pipeline). */
export function statusForStage(stage: ProcessingStage): AssessmentStatus | null {
  for (const status of PIPELINE_STATUSES) {
    if (PIPELINE_SUBSEQUENCE[status]?.includes(stage)) {
      return status;
    }
  }
  return null;
}

/** The stages valid while the assessment is in the given pipeline status. */
export function stagesOfStatus(status: AssessmentStatus): readonly ProcessingStage[] {
  return PIPELINE_SUBSEQUENCE[status] ?? [];
}

/** Next stage in the strict order, or null at COMPLETE. */
export function advanceStage(stage: ProcessingStage): ProcessingStage | null {
  const index = PROCESSING_STAGE_ORDER.indexOf(stage);
  if (index === -1 || index === PROCESSING_STAGE_ORDER.length - 1) {
    return null;
  }
  return PROCESSING_STAGE_ORDER[index + 1];
}

/**
 * Throws on an illegal status transition. Used by every pipeline writer so a
 * transition cut-point violation is caught at the boundary, not deep inside an
 * engine. Throwing here is deliberate: it is an invariant violation, not a
 * recoverable user error.
 */
export function assertTransition(from: AssessmentStatus, to: AssessmentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal 2K status transition: ${from} → ${to}`);
  }
}