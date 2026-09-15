import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relationshipFor,
  resolveTeacherReportContext,
  EMPTY_REPORT_CONTEXT,
  type ReportContext,
} from "@/lib/org/report-context";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";

function ctx(overrides: Partial<ReportContext>): ReportContext {
  return { ...EMPTY_REPORT_CONTEXT, ...overrides };
}

// ── relationshipFor — pure label mapping, no Supabase needed ────────────────

test("viewer is the learner themselves → self view", () => {
  const r = relationshipFor(ctx({ viewer_user_id: STUDENT_ID, can_view: true }), STUDENT_ID);
  assert.equal(r.kind, "self");
  assert.equal(r.label, "Learner's own view");
});

test("assigned primary teacher → primary-coach, the assignment link is the grant", () => {
  const r = relationshipFor(
    ctx({ viewer_org_role: "teacher", viewer_assignment_role: "primary", can_view: true }),
    STUDENT_ID
  );
  assert.equal(r.kind, "primary-coach");
  assert.match(r.description, /assigned primary teacher/);
});

test("assigned specialist → specialist-coach", () => {
  const r = relationshipFor(
    ctx({ viewer_org_role: "teacher", viewer_assignment_role: "specialist", can_view: true }),
    STUDENT_ID
  );
  assert.equal(r.kind, "specialist-coach");
});

test("org owner without a direct assignment → owner", () => {
  const r = relationshipFor(ctx({ viewer_org_role: "owner", can_view: true }), STUDENT_ID);
  assert.equal(r.kind, "owner");
});

test("hr admin without a direct assignment → hr", () => {
  const r = relationshipFor(ctx({ viewer_org_role: "hr", can_view: true }), STUDENT_ID);
  assert.equal(r.kind, "hr");
});

test("teacher with no assignment link → teacher bystander, not granted by role alone", () => {
  const r = relationshipFor(ctx({ viewer_org_role: "teacher", can_view: false }), STUDENT_ID);
  assert.equal(r.kind, "teacher");
  assert.match(r.description, /no direct assignment link/);
});

test("no membership, no assignment → other", () => {
  const r = relationshipFor(ctx({}), STUDENT_ID);
  assert.equal(r.kind, "other");
});

// ── resolveTeacherReportContext — RPC fetch + normalization ─────────────────

test("RPC failure fails closed → null, never a grant", async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: { message: "rpc exploded" } }),
  };
  const resolved = await resolveTeacherReportContext(supabase as never, STUDENT_ID);
  assert.equal(resolved, null);
});

test("empty payload normalizes to EMPTY_REPORT_CONTEXT with can_view false", async () => {
  const supabase = {
    rpc: async () => ({ data: {}, error: null }),
  };
  const resolved = await resolveTeacherReportContext(supabase as never, STUDENT_ID);
  assert.equal(resolved?.can_view, false);
  assert.equal(resolved?.viewer_assignment_role, null);
  assert.equal(resolved?.primary_teacher, null);
});

test("full payload carries the teacher→student assignment link", async () => {
  const payload = {
    can_view: true,
    viewer_user_id: "teacher-user-1",
    viewer_org_role: "teacher",
    viewer_teacher_id: "teacher-1",
    viewer_assignment_role: "primary",
    student_name: "Phuong",
    target_level: "B2.2",
    native_language: "vi",
    employer_id: "employer-1",
    organisation_id: "org-1",
    organisation_name: "Celadon BPO",
    primary_teacher: { id: "teacher-1", full_name: "Coach Linh", email: "coach@example.test" },
  };
  const supabase = {
    rpc: async (_fn: string, _args: Record<string, unknown>) => ({ data: payload, error: null }),
  };
  const resolved = await resolveTeacherReportContext(supabase as never, STUDENT_ID);
  assert.equal(resolved?.can_view, true);
  assert.equal(resolved?.viewer_assignment_role, "primary");
  assert.equal(resolved?.viewer_teacher_id, "teacher-1");
  assert.equal(resolved?.organisation_name, "Celadon BPO");
  assert.deepEqual(resolved?.primary_teacher, {
    id: "teacher-1",
    full_name: "Coach Linh",
    email: "coach@example.test",
  });
});

test("garbage assignment_role and missing primary_teacher are normalized away", async () => {
  const payload = {
    can_view: true,
    viewer_assignment_role: "department-head",
    primary_teacher: null,
  };
  const supabase = {
    rpc: async () => ({ data: payload, error: null }),
  };
  const resolved = await resolveTeacherReportContext(supabase as never, STUDENT_ID);
  assert.equal(resolved?.viewer_assignment_role, null);
  assert.equal(resolved?.primary_teacher, null);
});