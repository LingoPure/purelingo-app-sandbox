/**
 * Shared loaders for the telemetry pages (A1 learner journey / A2 result /
 * A3 teacher report). All read the same frozen engine chain via
 * loadPipelineResult so the pages cannot drift from the API endpoints.
 *
 * RLS: every loader is gated through the `org_can_view_student` database
 * function (0038) BEFORE querying assessment data. The database policies
 * (0040) are the enforcement backstop; these loaders are the strict
 * app-side gate — a viewer who cannot see the learner gets an empty list /
 * null pipeline and querying is skipped entirely. An explicit `canView`
 * option lets a caller reuse an already-resolved gate instead of re-running
 * the RPC; when omitted the gate resolves through the database and fails
 * closed (an unresolved permission is not permission — mirrors hr/auth.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadPipelineResult,
  canViewStudent,
  resolveStudentViewGate,
  type LoadedPipeline,
  type StudentViewGate,
} from "@/lib/2k/pipeline-loader";

export type { StudentViewGate };
export { canViewStudent } from "@/lib/2k/pipeline-loader";

export type AssessmentSummary = {
  assessment_id: string;
  learner_id: string;
  session_id: string;
  language: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

/** A learner's completed assessments, newest first — gated by org_can_view_student. */
export async function listCompletedAssessments(
  supabase: SupabaseClient,
  learnerId: string,
  limit = 20,
  overrides?: StudentViewGate
): Promise<AssessmentSummary[]> {
  const canView = await resolveStudentViewGate(supabase, learnerId, overrides);
  if (!canView) return [];

  const { data, error } = await supabase
    .from("assessment_sessions")
    .select("assessment_id, learner_id, session_id, language, status, created_at, completed_at")
    .eq("learner_id", learnerId)
    .in("status", ["COMPLETE"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as AssessmentSummary[];
}

/** Full pipeline result for one assessment — gated by org_can_view_student. */
export async function loadAssessmentPipeline(
  supabase: SupabaseClient,
  assessmentId: string,
  overrides?: StudentViewGate
): Promise<LoadedPipeline | null> {
  try {
    return await loadPipelineResult(supabase, assessmentId, true, overrides);
  } catch {
    return null;
  }
}

/** Rich history: newest → oldest frozen results for a learner (up to `limit`). */
export async function loadResultHistory(
  supabase: SupabaseClient,
  learnerId: string,
  limit = 12,
  overrides?: StudentViewGate
): Promise<LoadedPipeline[]> {
  const gate = await resolveStudentViewGate(supabase, learnerId, overrides);
  if (!gate) return [];

  const summaries = await listCompletedAssessments(supabase, learnerId, limit, {
    canView: gate,
  });
  const loaded: LoadedPipeline[] = [];
  for (const summary of summaries) {
    const pipeline = await loadAssessmentPipeline(supabase, summary.assessment_id, {
      canView: gate,
    });
    if (pipeline) loaded.push(pipeline);
  }
  return loaded;
}

/** Latest completed assessment (or null) — gated by org_can_view_student. */
export async function loadLatestPipeline(
  supabase: SupabaseClient,
  learnerId: string,
  overrides?: StudentViewGate
): Promise<LoadedPipeline | null> {
  const gate = await resolveStudentViewGate(supabase, learnerId, overrides);
  if (!gate) return null;

  const summaries = await listCompletedAssessments(supabase, learnerId, 1, {
    canView: gate,
  });
  if (!summaries.length) return null;
  return loadAssessmentPipeline(supabase, summaries[0].assessment_id, {
    canView: gate,
  });
}