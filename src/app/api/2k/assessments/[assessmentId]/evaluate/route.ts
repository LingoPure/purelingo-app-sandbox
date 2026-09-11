/**
 * POST /api/2k/assessments/{assessmentId}/evaluate — canonical endpoint #6.
 * Requests 2K evaluation once evidence minimums are met. Moves the session
 * IN_PROGRESS → RESPONSES_COMPLETE (pipeline enqueued, stage = INGESTION).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestEvaluation, AssessmentServiceError } from "@/lib/2k/service";
import type { EvaluateRequest } from "@/lib/2k/api-contract";

export async function POST(req: NextRequest, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { assessmentId } = await ctx.params;
  try {
    const body = (await req.json().catch(() => null)) as EvaluateRequest | null;
    void body?.reason;
    const assessment = await requestEvaluation(supabase, createAdminClient(), user, assessmentId);
    return NextResponse.json({ assessment });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}