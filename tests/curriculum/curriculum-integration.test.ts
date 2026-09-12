import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCurriculumIfNecessary } from "@/lib/2k/curriculum-integration";

type SupabaseLike = {
  from: () => {
    select: () => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown }>;
        single: () => Promise<{ data: unknown; error?: { message: string } }>;
      };
    };
  };
};

function buildSupabaseMock(
  existingCurriculum: boolean,
  targetLevel: string | null
): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: existingCurriculum ? { curriculum_id: "cur-1" } : null,
          }),
          single: async () => ({
            data: targetLevel ? { target_level: targetLevel } : null,
            error: targetLevel ? undefined : { message: "not found" },
          }),
        }),
      }),
    }),
  };
}

const SESSION = {
  assessment_id: "a-1",
  learner_id: "s-1",
  session_id: "sess",
  language: "en",
  question_bank_version: "v1",
  status: "COMPLETE",
};

const RESULT = {
  lp1000: { score: 750, band: "Professional", confidence: 0.8, components: {} },
  capabilities: [
    {
      address: "speaking_fluency",
      level: "B2" as const,
      confidence: 0.5,
    },
  ],
};

test("skips generation when a curriculum already exists", async () => {
  const supabase = buildSupabaseMock(true, "B1");
  let called = false;
  const spy = async () => {
    called = true;
    return "cur-1";
  };

  await generateCurriculumIfNecessary(
    supabase as never,
    SESSION as never,
    RESULT as never,
    spy as never
  );
  assert.equal(called, false);
});

test("skips generation when the student has no target level", async () => {
  const supabase = buildSupabaseMock(false, null);
  let called = false;
  const spy = async () => {
    called = true;
    return "cur-1";
  };

  await generateCurriculumIfNecessary(
    supabase as never,
    SESSION as never,
    RESULT as never,
    spy as never
  );
  assert.equal(called, false);
});

test("generates a curriculum when missing and target level exists", async () => {
  const supabase = buildSupabaseMock(false, "B2");
  let passed: unknown = null;
  const spy = async (_admin: never, _sid: string, _baseline: never, target: string) => {
    passed = target;
    return "cur-1";
  };

  await generateCurriculumIfNecessary(
    supabase as never,
    SESSION as never,
    RESULT as never,
    spy as never
  );
  assert.equal(passed, "B2");
});