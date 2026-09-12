import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSkillGaps,
  generatePlan,
  evaluateReset,
  type BaselineSnapshot,
  type CurriculumPlan,
  type CurriculumInputsSnapshot,
} from "@/lib/curriculum/curriculum-engine";

const BASELINE: BaselineSnapshot = {
  assessment_id: "assessment-001",
  learner_id: "student-001",
  generated_at: "2026-01-01T00:00:00Z",
  lp1000: {
    score: 500,
    band: "Professional",
    components: {
      speaking_fluency: 400,
      listening_comprehension: 500,
      writing_formal: 450,
      reading_intent: 550,
      business_vocabulary: 350,
      presentation_delivery: 600,
    },
  },
  cefr_macro: "B1",
  capabilities: [
    { address: "speaking_fluency", score: 400, level: "B1" },
    { address: "listening_comprehension", score: 500, level: "B1" },
    { address: "writing_formal", score: 450, level: "B1" },
    { address: "reading_intent", score: 550, level: "B2" },
    { address: "business_vocabulary", score: 350, level: "A2" },
    { address: "presentation_delivery", score: 600, level: "B2" },
  ],
};

const EMPTY_INPUTS: CurriculumInputsSnapshot = {
  completions: [],
  feedback: [],
  observations: [],
  version: 1,
  generated_at: "2026-01-01T00:00:00Z",
};

function buildPlan(): CurriculumPlan {
  return generatePlan({
    student_id: "student-001",
    baseline: BASELINE,
    cefr_target: "B2",
    existing_lessons: [],
    completions: [],
    feedback: [],
    observations: [],
  });
}

// ─── Skill gap tests ──────────────────────────────────────────────────────────

test("computeSkillGaps: scores below target are flagged AT_RISK", () => {
  const gaps = computeSkillGaps(BASELINE, "B2", [], []);

  const bizVocab = gaps.find((g) => g.skill === "business_vocabulary");
  assert.ok(bizVocab, "business_vocabulary gap exists");
  assert.equal(bizVocab.status, "AT_RISK");
  assert.ok(bizVocab.gap > 0, "gap is positive");
});

test("computeSkillGaps: scores above target are CLEAR", () => {
  const gaps = computeSkillGaps(BASELINE, "B2", [], []);

  const presentation = gaps.find((g) => g.skill === "presentation_delivery");
  assert.ok(presentation, "presentation_delivery gap exists");
  assert.equal(presentation.status, "CLEAR");
});

test("computeSkillGaps: completions improve current score", () => {
  const gaps_before = computeSkillGaps(BASELINE, "B2", [], []);
  const gaps_after = computeSkillGaps(BASELINE, "B2", [
    { lesson_id: "l1", modality: "speaking", skill: "speaking_fluency", completed_at: "2026-01-02T00:00:00Z" },
    { lesson_id: "l2", modality: "speaking", skill: "speaking_fluency", completed_at: "2026-01-03T00:00:00Z" },
  ], []);

  const before = gaps_before.find((g) => g.skill === "speaking_fluency")!;
  const after = gaps_after.find((g) => g.skill === "speaking_fluency")!;

  assert.ok(after.current > before.current, "completions improved score");
  assert.ok(after.gap < before.gap, "gap reduced");
});

test("computeSkillGaps: negative feedback penalises score", () => {
  const gaps_before = computeSkillGaps(BASELINE, "B2", [], []);
  const gaps_after = computeSkillGaps(BASELINE, "B2", [], [
    { skill: "writing_formal", outcome_status: "negative", created_at: "2026-01-02T00:00:00Z" },
    { skill: "writing_formal", outcome_status: "negative", created_at: "2026-01-03T00:00:00Z" },
  ]);

  const before = gaps_before.find((g) => g.skill === "writing_formal")!;
  const after = gaps_after.find((g) => g.skill === "writing_formal")!;

  assert.ok(after.current < before.current, "negative feedback reduced score");
});

// ─── Generate plan tests ──────────────────────────────────────────────────────

test("generatePlan: produces lessons for every AT_RISK skill", () => {
  const plan = buildPlan();
  const at_risk_skills = computeSkillGaps(BASELINE, "B2", [], [])
    .filter((g) => g.gap > 0)
    .map((g) => g.skill);

  const plan_skills = [...new Set(plan.lessons.map((l) => l.skill))];
  for (const skill of at_risk_skills) {
    assert.ok(plan_skills.includes(skill), `lesson exists for ${skill}`);
  }
});

test("generatePlan: lessons have valid modalities for their skill", () => {
  const plan = buildPlan();
  for (const lesson of plan.lessons) {
    assert.ok(
      ["live_tutor", "writing", "speaking", "comprehension"].includes(lesson.modality),
      `valid modality: ${lesson.modality}`,
    );
  }
});

test("generatePlan: student_id and version are correct", () => {
  const plan = buildPlan();
  assert.equal(plan.student_id, "student-001");
  assert.equal(plan.version, 1);
});

// ─── Reset evaluation tests ───────────────────────────────────────────────────

test("evaluateReset: no reset when inputs unchanged", () => {
  const plan = buildPlan();
  const result = evaluateReset({
    existing_plan: plan,
    new_completions: [],
    new_feedback: [],
    new_observations: [],
  });

  assert.equal(result.should_reset, false);
});

test("evaluateReset: triggers reset on 2+ negative feedback entries", () => {
  const plan = buildPlan();
  const result = evaluateReset({
    existing_plan: plan,
    new_completions: [],
    new_feedback: [
      { skill: "writing_formal", outcome_status: "negative", created_at: "2026-01-02T00:00:00Z" },
      { skill: "writing_formal", outcome_status: "inconclusive", created_at: "2026-01-03T00:00:00Z" },
    ],
    new_observations: [],
  });

  assert.equal(result.should_reset, true);
  assert.ok(result.new_plan, "new plan produced");
  assert.equal(result.new_plan!.version, 2);
  assert.ok(result.reset, "reset record produced");
});

test("evaluateReset: reset reason contains feedback context", () => {
  const plan = buildPlan();
  const result = evaluateReset({
    existing_plan: plan,
    new_completions: [],
    new_feedback: [
      { skill: "speaking_fluency", outcome_status: "negative", created_at: "2026-01-02T00:00:00Z" },
      { skill: "listening_comprehension", outcome_status: "inconclusive", created_at: "2026-01-03T00:00:00Z" },
    ],
    new_observations: [],
  });

  assert.ok(result.reason?.includes("negative"), "reason mentions negative feedback");
});
