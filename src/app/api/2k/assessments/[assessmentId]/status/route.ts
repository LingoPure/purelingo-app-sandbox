/**
 * GET /api/2k/assessments/{assessmentId}/status — processing trace (ISS-040 / C22).
 *
 * Returns the current assessment state plus the full append-only processing
 * event ledger, so the team can trace every assessment and identify exactly
 * where processing stands or failed (G12).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { assessmentId } = await ctx.params;

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("assessment_id, learner_id, status, processing_stage, processing_error, processing_retries, created_at, updated_at")
    .eq("assessment_id", assessmentId)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }
  if (session.learner_id !== user.id) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const { data: events, error: eventsError } = await supabase
    .from("assessment_processing_events")
    .select("event_id, from_status, to_status, from_stage, to_stage, action, detail, terminal, created_at")
    .eq("assessment_id", assessmentId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const terminal = session.status === "COMPLETE" || session.status === "FAILED";
  const can_retry = session.status === "FAILED";

  return NextResponse.json({
    status: session.status,
    processing_stage: session.processing_stage ?? null,
    processing_error: session.processing_error ?? null,
    processing_retries: session.processing_retries,
    terminal,
    can_retry,
    last_events: (events ?? []).map((e) => ({
      event_id: String(e.event_id),
      occurred_at: String(e.created_at),
      from_status: e.from_status ?? undefined,
      to_status: e.to_status,
      from_stage: e.from_stage ?? undefined,
      to_stage: e.to_stage ?? undefined,
      action: e.action,
      detail: e.detail ?? {},
      terminal: Boolean(e.terminal),
    })),
  });
}