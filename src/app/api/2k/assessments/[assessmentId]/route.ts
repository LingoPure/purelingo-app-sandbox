/**
 * GET /api/2k/assessments/{assessmentId} — canonical endpoint #2.
 * Loads current session state + coverage progress for resume/render.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssessment, AssessmentServiceError } from "@/lib/2k/service";

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { assessmentId } = await ctx.params;
  try {
    const result = await getAssessment(supabase, user, assessmentId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}