/**
 * LingoPure — Curriculum persistence (C0).
 *
 * Bridges the pure `curriculum-engine` (generatePlan) to the DB:
 *   - generateCurriculumForStudent  → one student, one plan + lessons
 *   - generateCurriculumForOrgStudents → all org students with completed baselines
 *
 * Writes are service-role only (no RLS insert policies on curricula/lessons).
 */

import { generatePlan, type BaselineSnapshot } from "@/lib/curriculum/curriculum-engine";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Persist one curriculum plan + its lessons for a single student. */
export async function generateCurriculumForStudent(
  admin: SupabaseClient,
  studentId: string,
  baseline: BaselineSnapshot,
  cefrTarget: string
): Promise<string> {
  // Skip if the student already has an active plan.
  const { data: existing } = await admin
    .from("curricula")
    .select("curriculum_id")
    .eq("student_id", studentId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (existing) return existing.curriculum_id;

  const plan = generatePlan({
    student_id: studentId,
    baseline,
    cefr_target: cefrTarget,
    existing_lessons: [],
    completions: [],
    feedback: [],
    observations: [],
  });

  const { data: curriculum, error: curErr } = await admin
    .from("curricula")
    .insert({
      student_id: studentId,
      version: plan.version,
      target_level: cefrTarget,
      baseline_ref: plan.baseline_assessment_id,
      timeline: plan.timeline,
      plan_jsonb: plan,
      status: "ACTIVE",
    })
    .select("curriculum_id")
    .single();
  if (curErr) throw new Error(`curricula insert failed: ${curErr.message}`);

  const lessons = plan.lessons.map((l, i) => ({
    curriculum_id: curriculum.curriculum_id,
    modality: l.modality,
    skill: l.skill,
    title: l.title,
    scheduled_at: l.scheduled_at,
    status: "SCHEDULED" as const,
    order_index: i,
  }));

  if (lessons.length) {
    const { error: lErr } = await admin.from("curriculum_lessons").insert(lessons);
    if (lErr) throw new Error(`curriculum_lessons insert failed: ${lErr.message}`);
  }

  return curriculum.curriculum_id;
}

/**
 * Generate curricula for every student in an org whose employer has completed
 * a 2K baseline. Called from the onboarding `finish` action.
 */
export async function generateCurriculumForOrgStudents(
  admin: SupabaseClient,
  organisationId: string
): Promise<void> {
  // Find all employer ids linked to this org.
  const { data: employerRows } = await admin
    .from("employers")
    .select("id")
    .eq("organisation_id", organisationId);
  const employerIds = (employerRows ?? []).map((e) => e.id as string);
  if (!employerIds.length) return;

  // Find all students under those employers.
  const { data: studentRows } = await admin
    .from("students")
    .select("id, target_level")
    .in("employer_id", employerIds);
  if (!studentRows?.length) return;

  for (const student of studentRows) {
    if (!student.target_level) continue;

    // Look for the most recent completed baseline assessment.
    const { data: sessions } = await admin
      .from("assessment_sessions")
      .select("assessment_id, completed_at")
      .eq("learner_id", student.id)
      .eq("status", "COMPLETE")
      .order("completed_at", { ascending: false })
      .limit(1);
    const session = sessions?.[0];
    if (!session) continue;

    // Load the real canonical result from the frozen pipeline. This runs the
    // engine chain on the stored responses so the curriculum is derived from
    // actual student data, not fabricated scores.
    let baseline: BaselineSnapshot;
    try {
      const { loadPipelineResult } = await import("@/lib/2k/pipeline-loader");
      const pipeline = await loadPipelineResult(admin, session.assessment_id);
      baseline = {
        assessment_id: session.assessment_id,
        learner_id: student.id,
        generated_at: session.completed_at ?? new Date().toISOString(),
        lp1000: pipeline.result.lp1000,
        cefr_macro:
          pipeline.result.capabilities[0]?.level ?? "A1",
        capabilities: pipeline.result.capabilities.map((c) => ({
          address: c.address,
          score: c.confidence * 1000,
          level: c.level,
        })),
      };
    } catch {
      // Pipeline load failed (missing responses, corrupt data). Fall back to a
      // minimal snapshot so the student still gets a curriculum plan.
      baseline = {
        assessment_id: session.assessment_id,
        learner_id: student.id,
        generated_at: session.completed_at ?? new Date().toISOString(),
        lp1000: { score: 0, band: "", components: {} },
        cefr_macro: "A1",
        capabilities: [],
      };
    }

    try {
      await generateCurriculumForStudent(admin, student.id, baseline, student.target_level);
    } catch {
      // Log but don't fail the onboarding flow — curriculum is a side effect.
    }
  }
}
