/**
 * POST /api/2k/interventions/{interventionId}/outcome — canonical endpoint #12
 * (ISS-037 — closed loop G10).
 *
 * Captures the teacher's outcome observation for an intervention, persists it
 * as a LessonOutcome, and converts it into new evidence appended to the
 * evidence pool so future state resolutions can consume it — without rewriting
 * any historical raw observation.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureLessonOutcome, outcomeToEvidence } from "@/lib/2k/outcome-capture";
import type { CaptureOutcomeRequest } from "@/lib/2k/api-contract";
import type { ConfoundLevel } from "@/lib/2k/contracts";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ interventionId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { interventionId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Partial<CaptureOutcomeRequest> | null;
  if (!body || !body.result_id || !body.teacher_action) {
    return NextResponse.json({ error: "result_id and teacher_action are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Persist the LessonOutcome (idempotent on outcome_id, generated here).
  const outcome = captureLessonOutcome({
    learner_id: user.id,
    result_id: body.result_id,
    intervention_id: interventionId,
    teacher_action: body.teacher_action,
    exposure: body.exposure ?? "unspecified",
    learner_response: body.learner_response ?? "",
    teacher_observation: body.teacher_observation ?? "",
    artifacts: body.artifacts ?? [],
    confounds: (body as { confounds?: ConfoundLevel }).confounds ?? "LOW",
    confound_notes: (body as { confound_notes?: string[] }).confound_notes,
    outcome_status: body.outcome_status ?? "inconclusive",
    next_action: body.next_action,
  });

  const { error: outcomeError } = await admin
    .from("lesson_outcomes")
    .upsert(outcome, { onConflict: "outcome_id" });
  if (outcomeError) {
    return NextResponse.json({ error: outcomeError.message }, { status: 500 });
  }

  // 2. Convert the outcome to new evidence and append it to the pool.
  const evidence = outcomeToEvidence(outcome, "learning.track_record");
  const { error: evidenceError } = await admin.from("evidence_objects").insert({
    evidence_id: evidence.evidence_id,
    assessment_id: body.assessment_id ?? null,
    result_id: body.result_id,
    construct: evidence.construct,
    observation: evidence.observation,
    status: evidence.status,
    authority: evidence.authority,
    source: evidence.source,
    provenance: { ...evidence.provenance },
    confidence: evidence.confidence,
  });
  if (evidenceError) {
    return NextResponse.json({ error: evidenceError.message }, { status: 500 });
  }

  // 3. Return the outcome — the loop is closed.
  return NextResponse.json({ outcome });
}