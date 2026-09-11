/**
 * POST /api/2k/assessments — canonical endpoint #1 (create assessment/session).
 *
 * Validates the CreateAssessmentRequest, creates a session in CREATED status,
 * and records the create event. RLS enforces learner_id = auth.uid().
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createAssessment,
  AssessmentServiceError,
} from "@/lib/2k/service";
import type { CreateAssessmentRequest } from "@/lib/2k/api-contract";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const body = (await req.json()) as CreateAssessmentRequest;
    if (!body?.session_id || !body?.language || !body?.question_bank_version) {
      return NextResponse.json({ error: "session_id, language and question_bank_version are required" }, { status: 400 });
    }
    const assessment = await createAssessment(supabase, user, body);
    return NextResponse.json({ assessment });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}