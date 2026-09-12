/**
 * LingoPure 2K — Curriculum Engine (C0).
 *
 * Generates and dynamically resets a per-student curriculum from:
 *   - Baseline assessment (LP-1000/LP-18 canonical result)
 *   - Target CEFR level
 *   - Lesson completions, tutor feedback, workplace observations
 *
 * Deterministic: pure derivation, no DB writes, no LLM calls. Every
 * output is reproducible given the same input.
 *
 * Engine version string: CUR-ENGINE-v1.0.0
 */

import type { SkillKey } from "@/lib/scoring/rubric";

export const CURRICULUM_ENGINE_VERSION = "CUR-ENGINE-v1.0.0";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAP_THRESHOLD = 100;

const MODALITY_MAP: Record<SkillKey, CurriculumModality[]> = {
  speaking_fluency: ["speaking", "live_tutor"],
  listening_comprehension: ["comprehension", "live_tutor"],
  writing_formal: ["writing"],
  reading_intent: ["writing"],
  business_vocabulary: ["writing", "live_tutor"],
  presentation_delivery: ["speaking", "live_tutor"],
};

const SKILL_TITLES: Record<SkillKey, string> = {
  speaking_fluency: "Speaking practice — monologue or dialogue",
  listening_comprehension: "Listening comprehension — repeat and interpret",
  writing_formal: "Writing practice — email or report draft",
  reading_intent: "Reading comprehension — subtext and intent",
  business_vocabulary: "Vocabulary drill — register-aware contexts",
  presentation_delivery: "Presentation practice — structured delivery",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurriculumModality = "live_tutor" | "writing" | "speaking" | "comprehension";

export interface BaselineSnapshot {
  assessment_id: string;
  learner_id: string;
  generated_at: string;
  lp1000: {
    score: number;
    band: string;
    components: Record<string, number>;
  };
  cefr_macro: string;
  capabilities: Array<{
    address: string;
    score: number;
    level: string;
  }>;
}

export interface CurriculumLesson {
  id: string;
  modality: CurriculumModality;
  skill: SkillKey;
  title: string;
  description: string;
  scheduled_at: string;
  status: "scheduled" | "completed" | "cancelled";
}

export interface CurriculumReset {
  curriculum_id: string;
  student_id: string;
  from_version: number;
  to_version: number;
  trigger_type: "INITIAL" | "LESSON_COMPLETION" | "TUTOR_FEEDBACK" | "WORK_OBSERVATION" | "MANUAL";
  trigger_key: string;
  rationale: string;
  created_at: string;
}

export interface CurriculumPlan {
  curriculum_id: string;
  student_id: string;
  version: number;
  baseline_assessment_id: string;
  baseline_generated_at: string;
  cefr_target: string;
  cefr_baseline: string;
  lp1000_target: number;
  lp1000_baseline: number;
  generated_at: string;
  status: "ACTIVE" | "SUPERSEDED";
  timeline: {
    start: string;
    target: string;
    weeks: number;
  };
  lessons: CurriculumLesson[];
  last_inputs_snapshot: CurriculumInputsSnapshot;
}

export interface CurriculumInputsSnapshot {
  completions: Array<{
    lesson_id: string;
    modality: CurriculumModality;
    skill: SkillKey;
    completed_at: string;
  }>;
  feedback: Array<{
    skill: SkillKey;
    outcome_status: string;
    created_at: string;
  }>;
  observations: Array<{
    skill: SkillKey;
    observation: string;
    created_at: string;
  }>;
  /** Baseline capability scores captured at generation — lets reset decisions
   *  reason about the REAL per-skill baseline instead of assuming a flat 500. */
  capabilities?: BaselineSnapshot["capabilities"];
  version: number;
  generated_at: string;
}

export interface GeneratePlanInput {
  student_id: string;
  baseline: BaselineSnapshot;
  cefr_target: string;
  existing_lessons: CurriculumLesson[];
  completions: CurriculumInputsSnapshot["completions"];
  feedback: CurriculumInputsSnapshot["feedback"];
  observations: CurriculumInputsSnapshot["observations"];
}

// ─── Deterministic ID ─────────────────────────────────────────────────────────

function deterministicId(prefix: string, input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

// ─── Gap computation ──────────────────────────────────────────────────────────

export interface SkillGap {
  skill: SkillKey;
  current: number;
  target: number;
  gap: number;
  status: "AT_RISK" | "CLEAR";
}

export function computeSkillGaps(
  baseline: BaselineSnapshot,
  cefr_target: string,
  completions: CurriculumInputsSnapshot["completions"],
  feedback: CurriculumInputsSnapshot["feedback"],
  observations: CurriculumInputsSnapshot["observations"] = []
): SkillGap[] {
  const cefr_score_map: Record<string, number> = {
    "A1": 200, "A2": 350, "B1": 500, "B2": 650, "C1": 800, "C2": 950,
  };
  const target_score = cefr_score_map[cefr_target] ?? 650;

  const skill_scores: Record<string, number> = {};
  for (const cap of baseline.capabilities) {
    skill_scores[cap.address] = cap.score ?? 0;
  }

  const completion_counts: Record<string, number> = {};
  for (const c of completions) {
    completion_counts[c.skill] = (completion_counts[c.skill] ?? 0) + 1;
  }

  const neg_feedback: Record<string, number> = {};
  for (const f of feedback) {
    if (f.outcome_status === "negative" || f.outcome_status === "inconclusive") {
      neg_feedback[f.skill] = (neg_feedback[f.skill] ?? 0) + 1;
    }
  }

  const observation_counts: Record<string, number> = {};
  for (const o of observations) {
    observation_counts[o.skill] = (observation_counts[o.skill] ?? 0) + 1;
  }

  const all_skills: SkillKey[] = [
    "speaking_fluency", "listening_comprehension", "writing_formal",
    "reading_intent", "business_vocabulary", "presentation_delivery",
  ];

  return all_skills.map((skill) => {
    const baseline_score = skill_scores[skill] ?? 500;
    const completion_boost = Math.min(50, (completion_counts[skill] ?? 0) * 15);
    const feedback_penalty = (neg_feedback[skill] ?? 0) * 20;
    // Workplace observations carry more weight than tutor feedback: a work
    // artifact demonstrates the gap directly, so each one widens it.
    const observation_penalty = (observation_counts[skill] ?? 0) * 40;
    const current = Math.max(
      0,
      Math.min(
        1000,
        baseline_score + completion_boost - feedback_penalty - observation_penalty,
      ),
    );
    const gap = Math.max(0, target_score - current);

    return {
      skill,
      current,
      target: target_score,
      gap,
      status: gap > GAP_THRESHOLD ? "AT_RISK" as const : "CLEAR" as const,
    };
  });
}

// ─── Curriculum generation ────────────────────────────────────────────────────

export function generatePlan(input: GeneratePlanInput): CurriculumPlan {
  const now = new Date().toISOString();
  const gaps = computeSkillGaps(
    input.baseline,
    input.cefr_target,
    input.completions,
    input.feedback,
    input.observations,
  );

  const gap_skills = gaps
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  const lessons: CurriculumLesson[] = [];
  let idx = 0;

  for (const gap of gap_skills) {
    const modalities = MODALITY_MAP[gap.skill] ?? ["writing"];
    for (const mod of modalities) {
      const id = deterministicId(
        "cur",
        `${input.student_id}-${gap.skill}-${mod}-${idx}`,
      );
      lessons.push({
        id,
        modality: mod,
        skill: gap.skill,
        title: SKILL_TITLES[gap.skill] ?? gap.skill,
        description: `${mod} for ${gap.skill} (gap: ${gap.gap})`,
        scheduled_at: new Date(
          Date.now() + idx * 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "scheduled",
      });
      idx++;
    }
  }

  const week_count = Math.max(1, Math.ceil(lessons.length / 3));

  return {
    curriculum_id: deterministicId("curriculum", `${input.student_id}-${now}`),
    student_id: input.student_id,
    version: 1,
    baseline_assessment_id: input.baseline.assessment_id,
    baseline_generated_at: input.baseline.generated_at,
    cefr_target: input.cefr_target,
    cefr_baseline: input.baseline.cefr_macro,
    lp1000_target: Number(
      { "A1": 200, "A2": 350, "B1": 500, "B2": 650, "C1": 800, "C2": 950 }[input.cefr_target] ?? 650,
    ),
    lp1000_baseline: input.baseline.lp1000.score,
    generated_at: now,
    status: "ACTIVE",
    timeline: {
      start: now,
      target: new Date(Date.now() + week_count * 7 * 24 * 60 * 60 * 1000).toISOString(),
      weeks: week_count,
    },
    lessons,
    last_inputs_snapshot: {
      completions: input.completions,
      feedback: input.feedback,
      observations: input.observations,
      capabilities: input.baseline.capabilities,
      version: 1,
      generated_at: now,
    },
  };
}

// ─── Reset evaluation ─────────────────────────────────────────────────────────

export interface ResetInput {
  existing_plan: CurriculumPlan;
  new_completions: CurriculumInputsSnapshot["completions"];
  new_feedback: CurriculumInputsSnapshot["feedback"];
  new_observations: CurriculumInputsSnapshot["observations"];
}

export interface ResetResult {
  should_reset: boolean;
  new_plan?: CurriculumPlan;
  reset?: CurriculumReset;
  reason?: string;
}

export function evaluateReset(input: ResetInput): ResetResult {
  const all_completions = [
    ...input.existing_plan.last_inputs_snapshot.completions,
    ...input.new_completions,
  ];
  const all_feedback = [
    ...input.existing_plan.last_inputs_snapshot.feedback,
    ...input.new_feedback,
  ];
  const all_observations = [
    ...input.existing_plan.last_inputs_snapshot.observations,
    ...input.new_observations,
  ];

  const planBaseline = (capabilities: BaselineSnapshot["capabilities"]): BaselineSnapshot => ({
    assessment_id: input.existing_plan.baseline_assessment_id,
    learner_id: input.existing_plan.student_id,
    generated_at: input.existing_plan.baseline_generated_at,
    lp1000: {
      score: input.existing_plan.lp1000_baseline,
      band: "",
      components: {},
    },
    cefr_macro: input.existing_plan.cefr_baseline,
    capabilities,
  });

  const settledCapabilities =
    input.existing_plan.last_inputs_snapshot.capabilities ?? [];

  const new_gaps = computeSkillGaps(
    planBaseline(settledCapabilities),
    input.existing_plan.cefr_target,
    all_completions,
    all_feedback,
    all_observations,
  );

  const prev_gaps = computeSkillGaps(
    planBaseline(settledCapabilities),
    input.existing_plan.cefr_target,
    input.existing_plan.last_inputs_snapshot.completions,
    input.existing_plan.last_inputs_snapshot.feedback,
    input.existing_plan.last_inputs_snapshot.observations,
  );

  const worst_prev = prev_gaps
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)[0];

  const worst_now = new_gaps
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)[0];

  const neg_feedback_count = input.new_feedback.filter(
    (f) => f.outcome_status === "negative" || f.outcome_status === "inconclusive",
  ).length;

  const should_reset =
    neg_feedback_count >= 2 ||
    (worst_now && worst_prev && worst_now.gap > worst_prev.gap);

  if (!should_reset) {
    return { should_reset: false };
  }

  const reason =
    neg_feedback_count >= 2
      ? `${neg_feedback_count} negative/inconclusive tutor feedback entries detected — reinforcing weak skills`
      : `Gap widened on ${worst_now?.skill} from ${worst_prev?.gap} to ${worst_now?.gap} — adjusting curriculum`;

  const new_plan = generatePlan({
    student_id: input.existing_plan.student_id,
    baseline: {
      assessment_id: input.existing_plan.baseline_assessment_id,
      learner_id: input.existing_plan.student_id,
      generated_at: input.existing_plan.baseline_generated_at,
      lp1000: {
        score: input.existing_plan.lp1000_baseline,
        band: "",
        components: {},
      },
      cefr_macro: input.existing_plan.cefr_baseline,
      capabilities: settledCapabilities,
    },
    cefr_target: input.existing_plan.cefr_target,
    existing_lessons: [],
    completions: all_completions,
    feedback: all_feedback,
    observations: all_observations,
  });

  new_plan.version = input.existing_plan.version + 1;

  const reset: CurriculumReset = {
    curriculum_id: new_plan.curriculum_id,
    student_id: input.existing_plan.student_id,
    from_version: input.existing_plan.version,
    to_version: new_plan.version,
    trigger_type:
      neg_feedback_count >= 2
        ? "TUTOR_FEEDBACK"
        : "WORK_OBSERVATION",
    trigger_key: `v${input.existing_plan.version}-v${new_plan.version}`,
    rationale: reason,
    created_at: new Date().toISOString(),
  };

  return {
    should_reset: true,
    new_plan,
    reset,
    reason,
  };
}
