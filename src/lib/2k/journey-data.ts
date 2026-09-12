/**
 * Shared loaders for the telemetry pages (A1 learner journey / A2 result /
 * A3 teacher report). All read the same frozen engine chain via
 * loadPipelineResult so the pages cannot drift from the API endpoints.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPipelineResult, type LoadedPipeline } from "@/lib/2k/pipeline-loader";

export type AssessmentSummary = {
  assessment_id: string;
  learner_id: string;
  session_id: string;
  language: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

/** A learner's completed assessments, newest first. */
export async function listCompletedAssessments(
  supabase: SupabaseClient,
  learnerId: string,
  limit = 20
): Promise<AssessmentSummary[]> {
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

/** Full pipeline result for one assessment. */
export async function loadAssessmentPipeline(
  supabase: SupabaseClient,
  assessmentId: string
): Promise<LoadedPipeline | null> {
  try {
    return await loadPipelineResult(supabase, assessmentId);
  } catch {
    return null;
  }
}

/** Rich history: newest → oldest frozen results for a learner (up to `limit`). */
export async function loadResultHistory(
  supabase: SupabaseClient,
  learnerId: string,
  limit = 12
): Promise<LoadedPipeline[]> {
  const summaries = await listCompletedAssessments(supabase, learnerId, limit);
  const loaded: LoadedPipeline[] = [];
  for (const summary of summaries) {
    const pipeline = await loadAssessmentPipeline(supabase, summary.assessment_id);
    if (pipeline) loaded.push(pipeline);
  }
  return loaded;
}

/** Latest completed assessment (or null). */
export async function loadLatestPipeline(
  supabase: SupabaseClient,
  learnerId: string
): Promise<LoadedPipeline | null> {
  const summaries = await listCompletedAssessments(supabase, learnerId, 1);
  if (!summaries.length) return null;
  return loadAssessmentPipeline(supabase, summaries[0].assessment_id);
}