import { type SupabaseClient } from "@supabase/supabase-js";
import { type AssessmentSession } from "@/lib/2k/contracts";
import { type CanonicalAssessmentResult } from "@/lib/2k/contracts";
import { generateCurriculumForStudent } from "@/lib/curriculum/curriculum-service";
import { type BaselineSnapshot } from "@/lib/curriculum/curriculum-engine";

export type CurriculumGenerator = (
  admin: SupabaseClient,
  studentId: string,
  baseline: BaselineSnapshot,
  cefrTarget: string
) => Promise<string>;

const defaultGenerator: CurriculumGenerator = generateCurriculumForStudent;

export async function generateCurriculumIfNecessary(
  supabase: SupabaseClient,
  session: AssessmentSession,
  result: CanonicalAssessmentResult,
  generate: CurriculumGenerator = defaultGenerator
) {
  // 1. Check if curriculum already exists
  const { data: existing } = await supabase
    .from("curricula")
    .select("curriculum_id")
    .eq("student_id", session.learner_id)
    .maybeSingle();

  if (existing) return;

  // 2. Fetch target level (from students table)
  const { data: student } = await supabase
    .from("students")
    .select("target_level")
    .eq("id", session.learner_id)
    .single();

  if (!student?.target_level) return;

  // 3. Generate baseline snapshot
  const baseline: BaselineSnapshot = {
    assessment_id: session.assessment_id,
    learner_id: session.learner_id,
    generated_at: new Date().toISOString(),
    lp1000: result.lp1000,
    cefr_macro: result.capabilities[0]?.level ?? "A1",
    capabilities: result.capabilities.map((c) => ({
      address: c.address,
      score: c.confidence * 1000,
      level: c.level,
    })),
  };

  await generate(supabase, session.learner_id, baseline, student.target_level);
}