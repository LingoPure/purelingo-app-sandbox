import { test } from "node:test";
import assert from "node:assert/strict";

// ── Onboarding service step-advancement logic ─────────────────────────────────
//
// Tests the step machine transitions by mocking the Supabase admin client.
// These are unit tests for the write path — they verify the right columns
// are set on `org_onboarding` for each wizard step, not the full DB round-trip.

type UpdateRecord = { step?: string; [key: string]: unknown };

function mockAdmin(updates: UpdateRecord[] = []) {
  const calls: { table: string; update: Record<string, unknown>; eq: [string, string] }[] = [];
  let updateIdx = 0;

  return {
    calls,
    client: {
      from(table: string) {
        return {
          select() { return this; },
          eq() { return this; },
          update(data: Record<string, unknown>) {
            calls.push({ table, update: data, eq: ["organisation_id", "org-1"] });
            return {
              eq(_col: string, _val: string) {
                updateIdx++;
                return { error: null };
              },
            };
          },
        };
      },
    } as never,
  };
}

// ── assignTeachers step persistence ────────────────────────────────────────────

test("assignTeachers persists step=baseline + teachers_assigned_at", async () => {
  // Import after all the existing imports
  const { assignTeachers } = await import("@/lib/org/service");

  const calls: { table: string; update: Record<string, unknown> }[] = [];
  const admin = {
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return { data: null, error: null }; },
        upsert() { return { error: null }; },
        update(data: Record<string, unknown>) {
          calls.push({ table, update: data });
          return { eq() { return { error: null }; } };
        },
      };
    },
  } as never;

  await assignTeachers(admin, "org-1", [
    { teacherUserId: "t-1", studentUserId: "s-1", assignmentRole: "primary" },
  ]);

  const onbUpdate = calls.find((c) => c.table === "org_onboarding");
  assert.ok(onbUpdate, "should update org_onboarding");
  assert.equal(onbUpdate.update.step, "baseline");
  assert.ok(
    typeof onbUpdate.update.teachers_assigned_at === "string",
    "should stamp teachers_assigned_at"
  );
});

// ── advanceBaseline ───────────────────────────────────────────────────────────

test("advanceBaseline persists step=curriculum + baseline_at", async () => {
  const { advanceBaseline } = await import("@/lib/org/service");

  const calls: { table: string; update: Record<string, unknown> }[] = [];
  const admin = {
    from(table: string) {
      return {
        update(data: Record<string, unknown>) {
          calls.push({ table, update: data });
          return { eq() { return { error: null }; } };
        },
      };
    },
  } as never;

  const result = await advanceBaseline(admin, "org-1");
  assert.equal(result, "curriculum");

  const onbUpdate = calls.find((c) => c.table === "org_onboarding");
  assert.ok(onbUpdate, "should update org_onboarding");
  assert.equal(onbUpdate.update.step, "curriculum");
  assert.ok(typeof onbUpdate.update.baseline_at === "string", "should stamp baseline_at");
});

// ── advanceCurriculumAndComplete ───────────────────────────────────────────────

test("advanceCurriculumAndComplete persists step=done + curriculum_at + completed_at", async () => {
  const { advanceCurriculumAndComplete } = await import("@/lib/org/service");

  const calls: { table: string; update: Record<string, unknown> }[] = [];
  const admin = {
    from(table: string) {
      return {
        update(data: Record<string, unknown>) {
          calls.push({ table, update: data });
          return { eq() { return { error: null }; } };
        },
      };
    },
  } as never;

  // advanceCurriculumAndComplete also calls generateCurriculumForOrgStudents
  // which queries employers/students — return empty results so it no-ops.
  const origAdmin = admin as Record<string, unknown>;
  const origFrom = admin.from;
  origAdmin.from = (table: string) => {
    const chain = {
      select() { return chain; },
      eq(_col: string, _val: string) { return chain; },
      order() { return chain; },
      in() { return chain; },
      limit() { return chain; },
      maybeSingle() { return { data: null, error: null }; },
      single() { return { data: null, error: null }; },
      update(data: Record<string, unknown>) {
        calls.push({ table, update: data });
        return { eq() { return { error: null }; } };
      },
    };
    // Return empty rows for curriculum generation queries
    return { ...chain, then: undefined };
  };

  await advanceCurriculumAndComplete(admin, "org-1");

  const onbUpdate = calls.find((c) => c.table === "org_onboarding");
  assert.ok(onbUpdate, "should update org_onboarding");
  assert.equal(onbUpdate.update.step, "done");
  assert.ok(typeof onbUpdate.update.curriculum_at === "string", "should stamp curriculum_at");
  assert.ok(typeof onbUpdate.update.completed_at === "string", "should stamp completed_at");
});
