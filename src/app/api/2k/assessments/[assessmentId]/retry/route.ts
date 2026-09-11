/**
 * POST /api/2k/assessments/{assessmentId}/retry — retry a FAILED assessment (ISS-039 / G11).
 *
 * Re-drives a FAILED session back through the pipeline (FAILED → RETRYING),
 * incrementing the retry counter and clearing the last error.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retryAssessment, AssessmentServiceError } from "@/lib/2k/service";

export async function POST(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { assessmentId } = await ctx.params;
  try {
    const assessment = await retryAssessment(supabase, createAdminClient(), user, assessmentId);
    return NextResponse.json({ assessment });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}