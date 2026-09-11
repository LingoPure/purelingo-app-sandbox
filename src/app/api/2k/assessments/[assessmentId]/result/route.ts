/**
 * GET /api/2k/assessments/{assessmentId}/result — canonical endpoint #7.
 *
 * Returns the frozen CanonicalAssessmentResult. ISS-013 wires a deterministic
 * dummy result sourced from the persisted responses; the full 2K pipeline
 * replaces this behind the same contract in Phase 3.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AssessmentServiceError } from "@/lib/2k/service";
import { buildDummyResult } from "@/lib/2k/dummy-result";

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { assessmentId } = await ctx.params;

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("learner_id", user.id)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select(
      "response_id, question_id, stage, task, client_transcript, timing, upload_status, processing_status"
    )
    .eq("assessment_id", assessmentId)
    .order("question_id");

  try {
    const result = buildDummyResult(
      {
        assessment_id: String(session.assessment_id),
        learner_id: String(session.learner_id),
        session_id: String(session.session_id),
        question_bank_version: String(session.question_bank_version),
        language: String(session.language),
        status: String(session.status),
        created_at: String(session.created_at),
      },
      (responses ?? []).map((r) => ({
        response_id: String(r.response_id),
        question_id: String(r.question_id),
        stage: String(r.stage),
        task: String(r.task),
        client_transcript: r.client_transcript ? String(r.client_transcript) : null,
        duration_ms:
          typeof r.timing === "object" && r.timing !== null && "duration_ms" in r.timing
            ? Number((r.timing as { duration_ms: number }).duration_ms)
            : null,
        upload_status: String(r.upload_status),
        processing_status: String(r.processing_status),
      }))
    );
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}