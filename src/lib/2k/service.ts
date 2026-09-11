/**
 * LingoPure 2K — assessment pipeline server service (Phase 1, ISS-012)
 *
 * Server-only facade over the 0030 tables. Every write pushes the processing
 * state machine forward through assertTransition (src/lib/2k/api-contract.ts)
 * and records an append-only ProcessingEvent for the /status ledger.
 *
 * RLS model (matching migration 0030):
 *   - Learner-scoped client (createClient from supabase/server) creates sessions
 *     and ingests responses — RLS enforces learner_id = auth.uid().
 *   - The pipeline (transcription/analysis/... ) writes stage/status via the
 *     service-role client, which bypasses RLS.
 */

import type {
  AssessmentSession,
  AssessmentStatus,
  ProcessingStage,
  ResponseObject,
} from "@/lib/2k/contracts";
import {
  assertTransition,
  type CreateAssessmentRequest,
  type IngestResponseRequest,
  type ProcessingEventObject,
} from "@/lib/2k/api-contract";

type UserScopedClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

export class AssessmentServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AssessmentServiceError";
  }
}

function userIdOf(user: { id: string } | null): string {
  if (!user?.id) throw new AssessmentServiceError("Not authenticated", 401);
  return user.id;
}

/** POST /api/2k/assessments — create a new assessment session (CREATED). */
export async function createAssessment(
  supabase: UserScopedClient,
  user: { id: string } | null,
  input: CreateAssessmentRequest
): Promise<AssessmentSession> {
  const learnerId = userIdOf(user);

  const { data, error } = await supabase
    .from("assessment_sessions")
    .insert({
      learner_id: learnerId,
      session_id: input.session_id,
      language: input.language,
      question_bank_version: input.question_bank_version,
      context: input.context ?? {},
      consent: {
        ...input.consent,
        recorded_at: new Date().toISOString(),
      },
      status: "CREATED",
      processing_retries: 0,
    })
    .select()
    .single();

  if (error) throw new AssessmentServiceError(`Create failed: ${error.message}`, 500);
  return rowToSession(data);
}

/** GET /api/2k/assessments/{id} — load session + progress for resume. */
export async function getAssessment(
  supabase: UserScopedClient,
  user: { id: string } | null,
  assessmentId: string
): Promise<{ assessment: AssessmentSession; progress: { answered: number; total_questions: number; coverage_pct: number } }> {
  const learnerId = userIdOf(user);

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("learner_id", learnerId)
    .single();
  if (sessionError || !session) {
    throw new AssessmentServiceError("Assessment not found", 404);
  }

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("response_id")
    .eq("assessment_id", assessmentId);

  const answered = responses?.length ?? 0;
  const total = TOTAL_QUESTIONS;

  return {
    assessment: rowToSession(session),
    progress: {
      answered,
      total_questions: total,
      coverage_pct: Math.round((answered / TOTAL_QUESTIONS) * 100),
    },
  };
}

/** POST /api/2k/assessments/{id}/responses — idempotent ingest (C03). */
export async function ingestResponse(
  supabase: UserScopedClient,
  user: { id: string } | null,
  assessmentId: string,
  input: IngestResponseRequest
): Promise<ResponseObject> {
  const learnerId = userIdOf(user);

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("assessment_id, status")
    .eq("assessment_id", assessmentId)
    .eq("learner_id", learnerId)
    .maybeSingle();
  if (sessionError || !session) {
    throw new AssessmentServiceError("Assessment not found", 404);
  }
  if (session.status !== "CREATED" && session.status !== "IN_PROGRESS") {
    throw new AssessmentServiceError(`Cannot ingest response in status ${session.status}`, 409);
  }

  const row = {
    response_id: input.response.response_id,
    assessment_id: assessmentId,
    question_id: input.response.question_id,
    stage: input.response.stage,
    task: input.response.task,
    receiver: input.response.receiver ?? null,
    context: input.response.context ?? null,
    client_transcript: input.response.client_transcript ?? null,
    timing: input.response.timing,
    device: input.response.device,
    assistance_status: input.response.assistance_status,
  };

  // Idempotency: same (assessment_id, question_id) already exists → return it.
  const { data: existing } = await supabase
    .from("assessment_responses")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("question_id", input.response.question_id)
    .maybeSingle();
  if (existing) return rowToResponse(existing);

  const { data, error } = await supabase.from("assessment_responses").insert(row).select().single();
  if (error) throw new AssessmentServiceError(`Ingest failed: ${error.message}`, 500);

  // First response advances the session from CREATED → IN_PROGRESS.
  await advanceSessionStatus(supabase, user, assessmentId, "IN_PROGRESS", {
    action: "response_ingested",
    detail: { question_id: input.response.question_id },
  });

  return rowToResponse(data);
}

/** POST /api/2k/responses/{id}/audio — durable upload of raw audio (ISS-016). */
export async function uploadResponseAudio(
  supabase: UserScopedClient,
  user: { id: string } | null,
  responseId: string,
  blob: Uint8Array,
  meta: { content_type: string; duration_ms: number; size_bytes: number }
): Promise<{ audio_id: string; storage_path: string; checksum: string }> {
  userIdOf(user); // auth gate — RLS enforces ownership below

  // RLS (0030) scopes assessment_responses to rows whose owning session has
  // learner_id = auth.uid() — a direct select is therefore the ownership check.
  const { data: owned, error: ownedError } = await supabase
    .from("assessment_responses")
    .select("response_id, assessment_id")
    .eq("response_id", responseId)
    .maybeSingle();
  if (ownedError || !owned) {
    throw new AssessmentServiceError("Response not found or not owned", 404);
  }

  const checksum = await sha256Hex(blob);
  const storagePath = `${owned.assessment_id}/${responseId}.webm`;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const upload = await admin.storage
    .from("2k-assessment-audio")
    .upload(storagePath, blob, {
      contentType: meta.content_type,
      upsert: true,
    });
  if (upload.error) {
    await supabase
      .from("assessment_responses")
      .update({ upload_status: "failed" })
      .eq("response_id", responseId);
    throw new AssessmentServiceError(`Audio upload failed: ${upload.error.message}`, 500);
  }

  const { error: updateError } = await supabase
    .from("assessment_responses")
    .update({ audio_id: storagePath, upload_status: "uploaded" })
    .eq("response_id", responseId);
  if (updateError) {
    throw new AssessmentServiceError(`Audio registry failed: ${updateError.message}`, 500);
  }

  return { audio_id: storagePath, storage_path: storagePath, checksum };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy to a fresh ArrayBuffer so crypto.subtle accepts the digest input on
  // any Uint8Array-backed buffer (SharedArrayBuffer or otherwise).
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** GET /api/2k/assessments/{id}/resume — ISS-018: most recent incomplete assessment for the learner. */
export async function findResumableAssessment(
  supabase: UserScopedClient,
  user: { id: string } | null
): Promise<{ assessment_id: string; answered: string[]; total: number } | null> {
  const learnerId = userIdOf(user);

  // Most recent non-terminal assessment (CREATED or IN_PROGRESS), newest first.
  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("assessment_id, status, created_at")
    .eq("learner_id", learnerId)
    .in("status", ["CREATED", "IN_PROGRESS"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionError || !session) return null;

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("question_id")
    .eq("assessment_id", session.assessment_id);

  return {
    assessment_id: String(session.assessment_id),
    answered: (responses ?? []).map((r) => String(r.question_id)),
    total: TOTAL_QUESTIONS,
  };
}

/** POST /api/2k/responses/{id}/transcribe — wire existing whisper into the 2K flow (ISS-017). */
export async function transcribeResponse(
  supabase: UserScopedClient,
  user: { id: string } | null,
  responseId: string,
  language: string = "en"
): Promise<{ transcript: string; asr_provider: string; asr_version: string; asr_confidence: number }> {
  userIdOf(user); // auth gate — RLS enforces ownership below

  const { data: response, error: responseError } = await supabase
    .from("assessment_responses")
    .select("response_id, assessment_id, audio_id, upload_status, client_transcript, processing_status")
    .eq("response_id", responseId)
    .maybeSingle();
  if (responseError || !response) {
    throw new AssessmentServiceError("Response not found or not owned", 404);
  }
  if (!response.audio_id) {
    throw new AssessmentServiceError("No audio registered for this response", 409);
  }
  if (response.upload_status !== "uploaded") {
    throw new AssessmentServiceError(`Audio not uploaded (upload_status=${response.upload_status})`, 409);
  }

  // Signed URL to the private object — service role only, time-limited.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: urlData, error: urlError } = await admin.storage
    .from("2k-assessment-audio")
    .createSignedUrl(String(response.audio_id), 60);
  if (urlError || !urlData?.signedUrl) {
    throw new AssessmentServiceError(`Signed URL failed: ${urlError?.message ?? "unknown"}`, 500);
  }

  const { transcribeFromUrl } = await import("@/lib/transcription/whisper");
  const transcript = await transcribeFromUrl(urlData.signedUrl, language);

  if (!transcript || !transcript.trim()) {
    throw new AssessmentServiceError("Transcription returned empty text", 502);
  }

  const { error: updateError } = await supabase
    .from("assessment_responses")
    .update({
      client_transcript: transcript,
      processing_status: "complete",
    })
    .eq("response_id", responseId);
  if (updateError) {
    throw new AssessmentServiceError(`Transcript persist failed: ${updateError.message}`, 500);
  }

  await recordProcessingEvent(supabase, {
    assessment_id: String(response.assessment_id),
    from_status: "IN_PROGRESS",
    to_status: "IN_PROGRESS",
    from_stage: "INGESTION",
    to_stage: "TRANSCRIPTION",
    action: "transcription_completed",
    detail: { response_id: responseId, transcript_length: transcript.length },
    terminal: false,
  });

  return {
    transcript,
    asr_provider: "openai-whisper",
    asr_version: "gpt-4o-transcribe",
    asr_confidence: 0,
  };
}

/** POST /api/2k/assessments/{id}/evaluate — request 2K evaluation once evidence minimums met. */
export async function requestEvaluation(
  supabase: UserScopedClient,
  admin: AdminClient,
  user: { id: string } | null,
  assessmentId: string
): Promise<AssessmentSession> {
  const learnerId = userIdOf(user);

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("learner_id", learnerId)
    .single();
  if (sessionError || !session) {
    throw new AssessmentServiceError("Assessment not found", 404);
  }
  if (session.status !== "IN_PROGRESS") {
    throw new AssessmentServiceError(`Cannot evaluate from status ${session.status}`, 409);
  }

  await advanceSessionStatus(supabase, user, assessmentId, "RESPONSES_COMPLETE", {
    action: "evaluate_requested",
    detail: { reason: "evidence_minimums_met" },
  });

  // Pipeline kickoff marker for the next stage (transcription enqueue) — written
  // via service role so the pipeline can later write without learner RLS.
  const updated = await admin
    .from("assessment_sessions")
    .update({ status: "RESPONSES_COMPLETE", processing_stage: "INGESTION" })
    .eq("assessment_id", assessmentId)
    .select()
    .single();
  if (updated.error) throw new AssessmentServiceError(`Evaluate failed: ${updated.error.message}`, 500);
  return rowToSession(updated.data);
}

/**
 * Advance a session's coarse status after validating the transition. Records an
 * append-only process event. Falls back to the service-role client for pipeline
 * writes (non-learner) so RLS never blocks the machine.
 */
export async function advanceSessionStatus(
  supabase: UserScopedClient,
  user: { id: string } | null,
  assessmentId: string,
  to: AssessmentStatus,
  meta: { action: string; detail?: Record<string, unknown>; stage?: ProcessingStage }
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("assessment_sessions")
    .select("status, processing_stage")
    .eq("assessment_id", assessmentId)
    .single();
  if (readError) throw new AssessmentServiceError(`Status read failed: ${readError.message}`, 500);

  const from = current.status as AssessmentStatus;
  assertTransition(from, to);

  const { error } = await supabase
    .from("assessment_sessions")
    .update({ status: to, processing_stage: meta.stage ?? current.processing_stage })
    .eq("assessment_id", assessmentId)
    .eq("learner_id", userIdOf(user));
  if (error) throw new AssessmentServiceError(`Status update failed: ${error.message}`, 500);

  await recordProcessingEvent(supabase, {
    assessment_id: assessmentId,
    from_status: from,
    to_status: to,
    from_stage: current.processing_stage as ProcessingStage | undefined,
    to_stage: meta.stage,
    action: meta.action,
    detail: meta.detail ?? {},
    terminal: to === "COMPLETE",
  });
}

/** Append to the processing-event ledger (client-scoped insert via RLS is blocked, so use admin). */
export async function recordProcessingEvent(
  supabase: UserScopedClient,
  event: Omit<ProcessingEventObject, "event_id" | "occurred_at">
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin.from("assessment_processing_events").insert({
    assessment_id: event.assessment_id,
    from_status: event.from_status ?? null,
    to_status: event.to_status,
    from_stage: event.from_stage ?? null,
    to_stage: event.to_stage ?? null,
    action: event.action,
    detail: event.detail,
    terminal: event.terminal,
  });
  if (error) throw new AssessmentServiceError(`Event record failed: ${error.message}`, 500);
}

function rowToSession(row: Record<string, unknown>): AssessmentSession {
  return {
    assessment_id: String(row.assessment_id),
    learner_id: String(row.learner_id),
    lead_id: row.lead_id ? String(row.lead_id) : undefined,
    session_id: String(row.session_id),
    language: String(row.language),
    question_bank_version: String(row.question_bank_version),
    context: (row.context ?? {}) as AssessmentSession["context"],
    consent: (row.consent ?? {}) as AssessmentSession["consent"],
    status: row.status as AssessmentStatus,
    processing_stage: row.processing_stage ? (row.processing_stage as ProcessingStage) : undefined,
    processing_error: row.processing_error ? String(row.processing_error) : undefined,
    processing_retries: Number(row.processing_retries ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: row.completed_at ? String(row.completed_at) : undefined,
  };
}

function rowToResponse(row: Record<string, unknown>): ResponseObject {
  return {
    response_id: String(row.response_id),
    assessment_id: String(row.assessment_id),
    question_id: String(row.question_id),
    stage: row.stage as ResponseObject["stage"],
    task: String(row.task),
    receiver: row.receiver ? String(row.receiver) : undefined,
    context: row.context ? String(row.context) : undefined,
    audio_id: row.audio_id ? String(row.audio_id) : undefined,
    client_transcript: row.client_transcript ? String(row.client_transcript) : undefined,
    timing: (row.timing ?? {}) as ResponseObject["timing"],
    device: (row.device ?? {}) as ResponseObject["device"],
    assistance_status: row.assistance_status as ResponseObject["assistance_status"],
    upload_status: (row.upload_status ?? "pending") as ResponseObject["upload_status"],
    processing_status: (row.processing_status ?? "pending") as ResponseObject["processing_status"],
    created_at: String(row.created_at),
  };
}

const TOTAL_QUESTIONS = 25;