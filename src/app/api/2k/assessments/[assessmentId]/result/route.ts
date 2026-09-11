/**
 * GET /api/2k/assessments/{assessmentId}/result — canonical endpoint #7 (ISS-036).
 *
 * Returns the frozen CanonicalAssessmentResult computed by the real 2K engine
 * chain (C07–C18) via the shared pipeline loader.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPipelineResult } from "@/lib/2k/pipeline-loader";

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { assessmentId } = await ctx.params;

  try {
    const loaded = await loadPipelineResult(supabase, assessmentId);
    if (loaded.session.learner_id !== user.id) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    return NextResponse.json({ result: loaded.result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Assessment not found" ? 404 : 500 });
  }
}