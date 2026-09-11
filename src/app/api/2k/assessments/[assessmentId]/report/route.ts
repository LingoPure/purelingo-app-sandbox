/**
 * GET /api/2k/assessments/{assessmentId}/report?type=learner|teacher —
 * canonical endpoint #8 (ISS-036).
 *
 * Resolves the frozen CanonicalAssessmentResult via the shared pipeline loader
 * and returns either the learner delivery view (C19) or the teacher
 * intelligence view (C20).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPipelineResult } from "@/lib/2k/pipeline-loader";
import { buildLearnerDeliveryView } from "@/lib/2k/learner-delivery";
import { buildTeacherIntelligenceView } from "@/lib/2k/teacher-intelligence";

export async function GET(req: NextRequest, ctx: { params: Promise<{ assessmentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { assessmentId } = await ctx.params;
  const type = req.nextUrl.searchParams.get("type") === "teacher" ? "teacher" : "learner";

  try {
    const loaded = await loadPipelineResult(supabase, assessmentId);
    const report =
      type === "teacher"
        ? buildTeacherIntelligenceView(loaded.result)
        : buildLearnerDeliveryView(loaded.result);

    return NextResponse.json({ report, type });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { error: message },
      { status: message === "Assessment not found" ? 404 : 500 }
    );
  }
}