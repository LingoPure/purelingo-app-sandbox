/**
 * Shared loader for 2K result routes (ISS-036).
 *
 * Reads the assessment session + responses from Supabase and computes the
 * frozen CanonicalAssessmentResult via the real engine chain.  Both the
 * `/result` and `/report` endpoints consume this so they cannot drift.
 */
import { runPipeline } from "@/lib/2k/pipeline-runner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ResponseObject,
  TranscriptObject,
  AssessmentSession,
  CanonicalAssessmentResult,
} from "@/lib/2k/contracts";

export interface LoadedPipeline {
  session: AssessmentSession;
  responseObjects: ResponseObject[];
  transcriptObjects: TranscriptObject[];
  result: CanonicalAssessmentResult;
}

export async function loadPipelineResult(
  supabase: SupabaseClient,
  assessmentId: string
): Promise<LoadedPipeline> {
  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("assessment_id", assessmentId)
    .single();

  if (sessionError || !session) throw new Error("Assessment not found");
  const s = session as Record<string, unknown>;

  const { data: responses, error: responsesError } = await supabase
    .from("assessment_responses")
    .select(
      "response_id, question_id, stage, task, receiver, context, client_transcript, timing, upload_status, processing_status, created_at"
    )
    .eq("assessment_id", assessmentId)
    .order("question_id");
  if (responsesError) throw new Error("Responses could not be loaded");

  const sessionObj: AssessmentSession = {
    assessment_id: String(s.assessment_id),
    learner_id: String(s.learner_id),
    session_id: String(s.session_id ?? ""),
    language: String(s.language ?? "en"),
    question_bank_version: String(s.question_bank_version ?? "v1"),
    context: (s.context as AssessmentSession["context"]) ?? {},
    consent:
      (s.consent as AssessmentSession["consent"]) ??
      { audio_recording: false, data_processing: false, recorded_at: "" },
    status: (s.status as AssessmentSession["status"]) ?? "COMPLETE",
    processing_retries: Number(s.processing_retries ?? 0),
    created_at: String(s.created_at ?? new Date().toISOString()),
    updated_at: String(s.updated_at ?? s.created_at ?? new Date().toISOString()),
  };

  const responseObjects: ResponseObject[] = ((responses as unknown[] | null) ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      response_id: String(row.response_id),
      assessment_id: assessmentId,
      question_id: String(row.question_id),
      stage: String(row.stage) as ResponseObject["stage"],
      task: String(row.task),
      receiver: row.receiver ? String(row.receiver) : undefined,
      context: row.context ? String(row.context) : undefined,
      client_transcript: row.client_transcript ? String(row.client_transcript) : undefined,
      timing: {
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_ms:
          typeof row.timing === "object" &&
          row.timing !== null &&
          "duration_ms" in (row.timing as object)
            ? Number((row.timing as { duration_ms: number }).duration_ms)
            : 0,
      },
      device: { browser: "unknown", os: "unknown", is_mobile: false },
      assistance_status: "none",
      upload_status: String(row.upload_status) as ResponseObject["upload_status"],
      processing_status: String(row.processing_status) as ResponseObject["processing_status"],
      created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    };
  });

  const transcriptObjects: TranscriptObject[] = (
    ((responses as unknown[] | null) ?? []) as Array<Record<string, unknown>>
  )
    .filter((row) => row.client_transcript)
    .map((row) => ({
      transcript_id: `tr-${String(row.response_id)}`,
      response_id: String(row.response_id),
      version: 1,
      text: String(row.client_transcript),
      language: String(sessionObj.language ?? "en"),
      asr_provider: "browser-stt",
      asr_version: "browser-stt",
      asr_confidence: 0.5,
      created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    }));

  const result = await runPipeline(sessionObj, responseObjects, transcriptObjects, []);

  await recordStageEvent(supabase, sessionObj, result);

  return { session: sessionObj, responseObjects, transcriptObjects, result };
}

/** Append a COMPLETE processing event once the frozen result is produced. */
async function recordStageEvent(
  supabase: SupabaseClient,
  session: AssessmentSession,
  result: CanonicalAssessmentResult
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  await admin.from("assessment_processing_events").insert({
    assessment_id: session.assessment_id,
    from_status: "RESPONSES_COMPLETE",
    to_status: "COMPLETE",
    from_stage: null,
    to_stage: null,
    action: "result_frozen",
    detail: {
      result_id: result.result_id,
      coverage_pct: result.coverage.coverage_pct,
      evidence_total: result.evidence_summary.total_evidence,
    },
    terminal: true,
  });
}