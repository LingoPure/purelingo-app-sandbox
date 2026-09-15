import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Onboarding service step-advancement logic ─────────────────────────────────
//
// Tests the step machine transitions by mocking the Supabase admin client.
// These are unit tests for the write path — they verify the right columns
// are set on `org_onboarding` for each wizard step, not the full DB round-trip.

type UpdateRecord = { table: string; update: Record<string, unknown> };

type AdminLike = (typeof window) extends never ? never : never;

function makeAdmin(calls: UpdateRecord[]): AdminLike {
  return {
    from(table: string) {
      return {
        select(this: unknown) { return this; },
        eq(this: unknown) { return this; },
        maybeSingle() { return { data: null, error: null }; },
        single() { return { data: null, error: null }; },
        order(this: unknown) { return this; },
        in(this: unknown) { return this; },
        limit(this: unknown) { return this; },
        upsert() { return { error: null }; },
        update(data: Record<string, unknown>) {
          calls.push({ table, update: data });
          return { eq() { return { error: null }; } };
        },
      };
    },
  } as AdminLike;
}

// ── assignTeachers step persistence ────────────────────────────────────────────

test("assignTeachers persists step=baseline + teachers_assigned_at", async () => {
  const { assignTeachers } = await import("@/lib/org/service");

  const calls: UpdateRecord[] = [];
  await assignTeachers(makeAdmin(calls) as unknown as SupabaseClient, "org-1", [
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

  const calls: UpdateRecord[] = [];
  const result = await advanceBaseline(
    makeAdmin(calls) as unknown as SupabaseClient,
    "org-1"
  );
  assert.equal(result, "curriculum");

  const onbUpdate = calls.find((c) => c.table === "org_onboarding");
  assert.ok(onbUpdate, "should update org_onboarding");
  assert.equal(onbUpdate.update.step, "curriculum");
  assert.ok(typeof onbUpdate.update.baseline_at === "string", "should stamp baseline_at");
});

// ── advanceCurriculumAndComplete ───────────────────────────────────────────────

test("advanceCurriculumAndComplete persists step=done + curriculum_at + completed_at", async () => {
  const { advanceCurriculumAndComplete } = await import("@/lib/org/service");

  const calls: UpdateRecord[] = [];
  // advanceCurriculumAndComplete also calls generateCurriculumForOrgStudents,
  // which queries employers/students — the chain above returns empty rows so it no-ops.
  await advanceCurriculumAndComplete(
    makeAdmin(calls) as unknown as SupabaseClient,
    "org-1"
  );

  const onbUpdate = calls.find((c) => c.table === "org_onboarding");
  assert.ok(onbUpdate, "should update org_onboarding");
  assert.equal(onbUpdate.update.step, "done");
  assert.ok(typeof onbUpdate.update.curriculum_at === "string", "should stamp curriculum_at");
  assert.ok(typeof onbUpdate.update.completed_at === "string", "should stamp completed_at");
});