/**
 * POST /api/2k/assessments/{assessmentId}/responses — canonical endpoint #3.
 * Idempotent response ingest (C03): same id → same row back.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestResponse, AssessmentServiceError } from "@/lib/2k/service";
import type { IngestResponseRequest } from "@/lib/2k/api-contract";

export async function POST(req: NextRequest, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { assessmentId } = await ctx.params;
  try {
    const body = (await req.json()) as IngestResponseRequest;
    if (!body?.response?.response_id || !body?.response?.question_id) {
      return NextResponse.json({ error: "response.response_id and response.question_id are required" }, { status: 400 });
    }
    const response = await ingestResponse(supabase, user, assessmentId, body);
    return NextResponse.json({ response });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}