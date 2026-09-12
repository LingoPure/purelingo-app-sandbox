import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSkillGaps,
  evaluateReset,
  generatePlan,
  type BaselineSnapshot,
} from "@/lib/curriculum/curriculum-engine";

const BASELINE: BaselineSnapshot = {
  assessment_id: "assessment-001",
  learner_id: "student-001",
  generated_at: "2026-01-01T00:00:00Z",
  lp1000: {
    score: 550,
    band: "Professional",
    components: {},
  },
  cefr_macro: "B1",
  capabilities: [
    { address: "speaking_fluency", score: 500, level: "B1" },
    { address: "writing_formal", score: 570, level: "B1" },
    { address: "listening_comprehension", score: 650, level: "B2" },
    { address: "reading_intent", score: 650, level: "B2" },
    { address: "business_vocabulary", score: 650, level: "B2" },
    { address: "presentation_delivery", score: 650, level: "B2" },
  ],
};

test("workplace observations widen the skill gap and flip status to AT_RISK", () => {
  const without = computeSkillGaps(BASELINE, "B2", [], [], []);
  const writing = without.find((g) => g.skill === "writing_formal");
  assert.ok(writing);
  assert.equal(writing.gap, 80); // 650 - 570, below the 100 threshold
  assert.equal(writing.status, "CLEAR");

  const withObs = computeSkillGaps(BASELINE, "B2", [], [], [
    {
      skill: "writing_formal",
      observation: "Work draft shows persistent register drift",
      created_at: "2026-02-01T00:00:00Z",
    },
  ]);
  const writingNow = withObs.find((g) => g.skill === "writing_formal");
  assert.ok(writingNow);
  assert.equal(writingNow.gap, 120); // 40-point workplace penalty
  assert.equal(writingNow.status, "AT_RISK");
});

test("observations trigger a WORK_OBSERVATION reset when the gap widens", () => {
  const plan = generatePlan({
    student_id: "student-001",
    baseline: BASELINE,
    cefr_target: "B2",
    existing_lessons: [],
    completions: [],
    feedback: [],
    observations: [],
  });

  const verdict = evaluateReset({
    existing_plan: plan,
    new_completions: [],
    new_feedback: [],
    new_observations: [
      {
        skill: "speaking_fluency",
        observation: "Call transcript shows mid-sentence stalls",
        created_at: "2026-02-01T00:00:00Z",
      },
    ],
  });

  assert.equal(verdict.should_reset, true);
  assert.deepEqual(verdict.reset?.trigger_type, "WORK_OBSERVATION");
  assert.ok(verdict.new_plan);
  assert.equal(verdict.new_plan.version, 2);
  assert.ok(verdict.reason?.includes("Gap widened"));
});

test("no observation change → no reset", () => {
  const plan = generatePlan({
    student_id: "student-001",
    baseline: BASELINE,
    cefr_target: "B2",
    existing_lessons: [],
    completions: [],
    feedback: [],
    observations: [],
  });
  const verdict = evaluateReset({
    existing_plan: plan,
    new_completions: [],
    new_feedback: [],
    new_observations: [],
  });
  assert.equal(verdict.should_reset, false);
});