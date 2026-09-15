import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getTeacherIdentity } from "@/lib/teacher/auth";

// ── Teacher portal data (C6) ──────────────────────────────────────────────────
//
// Roster/detail loaders gate on the teacher→student assignment (student_
// teacher_assignments, active rows only); classes come from classin_sessions
// (0049 grants org/teacher read); notes carry a student_id filter. These tests
// pin the write-path-free read contracts the portal pages rely on.

const USER: User = { id: "u-1", aud: "authenticated", role: "authenticated" } as User;

function assignmentsClient(opts: {
  assignment?: unknown;
  noRows?: boolean;
}): SupabaseClient {
  const c = {
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: async () =>
          opts.noRows
            ? { data: null, error: null }
            : { data: [opts.assignment ?? { student_id: "s-1" }], error: null },
        maybeSingle: async () =>
          opts.noRows ? { data: null, error: null } : { data: opts.assignment ?? null, error: null },
        in: () => chain,
        limit: () => chain,
      };
      return chain;
    },
    rpc: async () => ({ data: true, error: null }),
  };
  return c as unknown as SupabaseClient;
}

test("getTeacherIdentity resolves the teachers row by auth_user_id", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "t-1", full_name: "Phuong Le", email: "phuong@lingopure.com" },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  const identity = await getTeacherIdentity(supabase, USER);
  assert.ok(identity);
  assert.equal(identity.teacherId, "t-1");
  assert.equal(identity.fullName, "Phuong Le");
});

test("getTeacherIdentity fails closed when the user is not a teacher", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  assert.equal(await getTeacherIdentity(supabase, USER), null);
});

test("loadTeacherStudents returns [] when there are no assignments", async () => {
  const { loadTeacherStudents } = await import("@/lib/teacher/portal-data");
  const rows = await loadTeacherStudents(assignmentsClient({ noRows: true }), "t-1");
  assert.deepEqual(rows, []);
});

test("loadTeacherClasses returns [] when there are no assignments", async () => {
  const { loadTeacherClasses } = await import("@/lib/teacher/portal-data");
  const rows = await loadTeacherClasses(assignmentsClient({ noRows: true }), "t-1");
  assert.deepEqual(rows, []);
});

test("loadTeacherClasses no-ops on empty student set (no in-query on empty)", async () => {
  const { loadTeacherClasses } = await import("@/lib/teacher/portal-data");
  let inCalls = 0;
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        in() {
          inCalls += 1;
          return this;
        },
        order: async () => ({ data: null, error: null }),
      };
    },
  } as unknown as SupabaseClient;
  await loadTeacherClasses(supabase, "t-1");
  assert.equal(inCalls, 0, "must skip the classin_sessions query when no students");
});

test("loadStudentClasses maps classin_sessions rows to ClassSession", async () => {
  const { loadStudentClasses } = await import("@/lib/teacher/portal-data");
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order: async () => ({
          data: [
            {
              id: "cs-1",
              scheduled_at: "2026-09-10T08:00:00Z",
              status: "scheduled",
              duration_mins: 30,
              teacher_name: "Phuong Le",
              recording_url: null,
              students: { name: "An Nguyen" },
            },
          ],
          error: null,
        }),
      };
    },
  } as unknown as SupabaseClient;
  const rows = await loadStudentClasses(supabase, "s-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].studentName, "An Nguyen");
  assert.equal(rows[0].status, "scheduled");
  assert.equal(rows[0].durationMins, 30);
});

test("loadTeacherNotes filters by student_id when provided", async () => {
  const { loadTeacherNotes } = await import("@/lib/teacher/notes");
  const calls: string[] = [];
  const chain: Record<string, unknown> = {
    select() { return chain; },
    order() { return chain; },
    limit() { return chain; },
    eq(col: string, val: string) {
      calls.push(`${col}=${val}`);
      return chain;
    },
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: [], error: null }),
  };
  const supabase = {
    from() {
      return {
        select() { return chain; },
        order() { return chain; },
        limit() { return chain; },
      };
    },
  } as unknown as SupabaseClient;
  await loadTeacherNotes(supabase, 10, "s-1");
  assert.ok(calls.includes("student_id=s-1"), "should scope the notes query to the student");
});

test("relationshipFor orders self > primary coach > owner > other", async () => {
  const { relationshipFor } = await import("@/lib/org/report-context");
  const base = {
    can_view: true,
    viewer_user_id: null,
    viewer_org_role: "owner",
    viewer_teacher_id: null,
    viewer_assignment_role: null,
    student_name: null,
    target_level: null,
    native_language: null,
    employer_id: null,
    organisation_id: null,
    organisation_name: null,
    primary_teacher: null,
  };
  assert.equal(relationshipFor(base, "s-1").kind, "owner");
  assert.equal(
    relationshipFor({ ...base, viewer_org_role: "teacher", viewer_assignment_role: "primary" }, "s-1")
      .kind,
    "primary-coach"
  );
  assert.equal(
    relationshipFor({ ...base, viewer_user_id: "s-1", viewer_org_role: "student" }, "s-1").kind,
    "self"
  );
  assert.equal(relationshipFor({ ...base, viewer_org_role: null }, "s-1").kind, "other");
});