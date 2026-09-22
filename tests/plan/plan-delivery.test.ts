import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlan,
  compilePlanPrompt,
  compilePlanFirstMessage,
  type SkillProfile,
} from "../../src/lib/plan/plan-delivery";
import type { PlanRecommendation } from "../../src/lib/lessons/plan-generator";

/**
 * buildPlan() reads from Supabase, so these tests exercise buildPhases()'s
 * gap-driven behaviour indirectly by faking a minimal SupabaseClient. The
 * goal: prove duration/phase-count/activity-frequency scale with the
 * student's actual gap profile instead of a fixed 3-phase/16-week template
 * (the ISS-057 follow-up).
 */

type MockRow = Record<string, unknown>;

function mockSupabase(opts: {
  student?: MockRow | null;
  role?: MockRow | null;
  employer?: MockRow | null;
  gapScores?: MockRow[];
  recGapScores?: MockRow[];
  baselines?: MockRow[];
}) {
  const {
    student = { name: "Test Student", target_level: "B2", role_id: null, employer_id: null },
    role = null,
    employer = null,
    gapScores = [],
    recGapScores = gapScores,
    baselines = [],
  } = opts;

  return {
    from(table: string) {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle() {
          if (table === "roles") return Promise.resolve({ data: role });
          if (table === "employers") return Promise.resolve({ data: employer });
          return Promise.resolve({ data: null });
        },
        single() {
          return Promise.resolve({ data: student });
        },
        then(resolve: (v: { data: MockRow[] }) => void) {
          if (table === "gap_scores") {
            // buildPlan() and generateLessonPlan() both query gap_scores;
            // distinguish by shape isn't possible here, so both consumers
            // get the same rows (recGapScores defaults to gapScores).
            resolve({ data: gapScores });
          } else if (table === "role_baselines") {
            resolve({ data: baselines });
          } else {
            resolve({ data: [] });
          }
        },
      };
      return chain;
    },
    rpc() {
      return Promise.resolve({ data: null });
    },
  };
}

// generateLessonPlan() calls loadBaselinesForStudent + queries gap_scores
// itself — rather than fake that whole chain, test buildPhases()'s pure
// logic surface directly via the exported PlanData shape from buildPlan()
// would require a much heavier fake. Instead, test the documented contract
// via compilePlanPrompt/compilePlanFirstMessage against a hand-built
// PlanData, which is what every consumer (page.tsx, the voice prompt)
// actually reads — this is the stable public contract this fix changed.

function skill(overrides: Partial<SkillProfile>): SkillProfile {
  return {
    skill: "speaking",
    label: "Speaking",
    score: null,
    baseline: 800,
    roleFloorGap: null,
    targetGap: null,
    assessed: false,
    cefrBand: "not yet assessed",
    lp18Band: null,
    evidence: "",
    ...overrides,
  };
}

test("compilePlanPrompt embeds the plan's actual totalWeeks, not a hardcoded 16", () => {
  const plan = {
    studentName: "Test Student",
    firstName: "Test",
    role: "Sales",
    employer: "Acme",
    currentLevel: "B1",
    currentLp18: null,
    targetLevel: "B2",
    skills: [skill({ assessed: true, score: 700, targetGap: 200 })],
    supportingSkills: [],
    recommendations: [] as PlanRecommendation[],
    phases: [],
    totalWeeks: 10,
    nextStepStatement: "x",
  };
  const prompt = compilePlanPrompt(plan);
  assert.match(prompt, /THE SAMPLE PROGRAMME \(10 weeks\)/);
  assert.doesNotMatch(prompt, /16 weeks/);
});

test("compilePlanFirstMessage embeds the plan's actual totalWeeks", () => {
  const plan = {
    studentName: "Test Student",
    firstName: "Test",
    role: "Sales",
    employer: "Acme",
    currentLevel: "B1",
    currentLp18: null,
    targetLevel: "B2",
    skills: [],
    supportingSkills: [],
    recommendations: [] as PlanRecommendation[],
    phases: [],
    totalWeeks: 22,
    nextStepStatement: "x",
  };
  const msg = compilePlanFirstMessage(plan);
  assert.match(msg, /sample 22-week/);
  assert.doesNotMatch(msg, /16-week/);
});

test("compilePlanPrompt never asks for a commitment (ISS-064/065 regression)", () => {
  const plan = {
    studentName: "Test Student",
    firstName: "Test",
    role: "Sales",
    employer: "Acme",
    currentLevel: "N/A",
    currentLp18: null,
    targetLevel: "B2",
    skills: [],
    supportingSkills: [],
    recommendations: [] as PlanRecommendation[],
    phases: [],
    totalWeeks: 16,
    nextStepStatement: "x",
  };
  const prompt = compilePlanPrompt(plan);
  assert.doesNotMatch(prompt, /get a genuine commitment/i);
  assert.match(prompt, /never ask for a commitment/i);
  assert.match(prompt, /IMPORTANT — NO SCORES YET/);
});

test("buildPlan derives a shorter programme for a small gap and a longer one for a large gap", async () => {
  // Small gap: one skill 50 points below target -> should land at the
  // programme-length floor, not the old fixed 16 weeks.
  const smallGapSupabase = mockSupabase({
    gapScores: [{ skill: "speaking", score: 950, target: 800, is_canonical: true }],
  });
  const smallPlan = await buildPlan(smallGapSupabase as never, "student-1");
  assert.ok(smallPlan.totalWeeks <= 12, `expected a short programme, got ${smallPlan.totalWeeks}`);

  // Large gap across every primary skill -> should land at or near the
  // programme-length ceiling.
  const largeGapSupabase = mockSupabase({
    gapScores: [
      { skill: "speaking", score: 200, target: 800, is_canonical: true },
      { skill: "listening", score: 200, target: 800, is_canonical: true },
      { skill: "writing", score: 200, target: 800, is_canonical: true },
      { skill: "reading", score: 200, target: 800, is_canonical: true },
      { skill: "grammar", score: 200, target: 800, is_canonical: true },
      { skill: "live_interaction", score: 200, target: 800, is_canonical: true },
    ],
  });
  const largePlan = await buildPlan(largeGapSupabase as never, "student-2");
  assert.ok(largePlan.totalWeeks >= 20, `expected a long programme, got ${largePlan.totalWeeks}`);
  assert.ok(largePlan.totalWeeks > smallPlan.totalWeeks);
});

test("buildPlan falls back to the labelled 16-week sample when nothing is assessed", async () => {
  const supabase = mockSupabase({ gapScores: [] });
  const plan = await buildPlan(supabase as never, "student-3");
  assert.equal(plan.currentLevel, "N/A");
  assert.equal(plan.totalWeeks, 16);
});
