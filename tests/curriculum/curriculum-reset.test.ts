import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePlan, type CurriculumPlan, type BaselineSnapshot } from "@/lib/curriculum/curriculum-engine";
import {
  applyWorkplaceEvidence,
  synthesizeObservations,
  type ObservationRow,
} from "@/lib/curriculum/curriculum-reset";
import { pseudonymousEmail } from "@/lib/bpo/generator";

const BASELINE: BaselineSnapshot = {
  assessment_id: "assessment-001",
  learner_id: "student-001",
  generated_at: "2026-01-01T00:00:00Z",
  lp1000: { score: 550, band: "Professional", components: {} },
  cefr_macro: "B1",
  capabilities: [
    { address: "speaking", score: 500, level: "B1" },
    { address: "listening", score: 650, level: "B2" },
    { address: "writing", score: 650, level: "B2" },
    { address: "reading", score: 650, level: "B2" },
    { address: "business_vocabulary", score: 650, level: "B2" },
    { address: "presentation_delivery", score: 650, level: "B2" },
  ],
};

function makePlan(studentId: string): CurriculumPlan {
  return generatePlan({
    student_id: studentId,
    baseline: BASELINE,
    cefr_target: "B2",
    existing_lessons: [],
    completions: [],
    feedback: [],
    observations: [],
  });
}

const PID = "bpo-acme-001";
const STUDENT_ID = "student-001";
const EMPLOYER_ID = "employer-001";

/** Minimal stateful admin mock covering exactly what applyWorkplaceEvidence uses. */
function makeAdmin(opts: {
  plan: CurriculumPlan;
  rows: ObservationRow[];
  studentEmail: string | null;
}) {
  const log: string[] = [];
  const data = { ...opts };
  const planRow = data.plan ? { plan_jsonb: data.plan } : data.plan;

  const admin = {
    log,
    from(table: string) {
      if (table === "curricula") {
        return {
          select: () => ({
            eq: (_col: string) => ({
              eq: (_col2: string) => ({
                maybeSingle: async () => {
                  log.push("curricula.load");
                  return { data: planRow };
                },
              }),
            }),
          }),
          update: (patch: unknown) => {
            log.push(`curricula.supersede:${JSON.stringify(patch)}`);
            return { eq: async () => ({ error: null }) };
          },
          insert: (row: unknown) => {
            log.push(`curricula.insert:${JSON.stringify(row)}`);
            return {
              select: () => ({
                single: async () => ({
                  data: { curriculum_id: "new-curriculum-002" },
                }),
              }),
            };
          },
        };
      }
      if (table === "workplace_observations") {
        return {
          select: () => ({
            gte: async () => ({ data: data.rows, error: null }),
          }),
        };
      }
      if (table === "students") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                log.push("students.lookup");
                return {
                  data: data.studentEmail ? { id: STUDENT_ID, email: data.studentEmail } : null,
                };
              },
            }),
          }),
        };
      }
      if (table === "curriculum_lessons") {
        return {
          insert: async (rows: unknown) => {
            log.push(`lessons.insert:${JSON.stringify(rows)}`);
            return { error: null };
          },
        };
      }
      if (table === "curriculum_resets") {
        return {
          insert: async (row: unknown) => {
            log.push(`resets.insert:${JSON.stringify(row)}`);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return admin;
}

test("synthesizeObservations maps owned-skill rows into engine observations", () => {
  const rows: ObservationRow[] = [
    {
      pseudonymous_id: PID,
      employer_id: EMPLOYER_ID,
      skill: "writing",
      observation: "register drift",
      created_at: "2030-01-01T00:00:00Z",
    },
    {
      pseudonymous_id: PID,
      employer_id: EMPLOYER_ID,
      skill: "speaking",
      observation: "mid-sentence stalls",
      created_at: "2030-01-01T00:00:01Z",
    },
  ];
  const out = synthesizeObservations(rows, "writing");
  assert.equal(out.length, 1);
  assert.equal(out[0].skill, "writing");
  assert.equal(out[0].observation, "register drift");
});

test("applyWorkplaceEvidence skips when the student has no ACTIVE plan", async () => {
  const admin = makeAdmin({ plan: null as never, rows: [], studentEmail: null });
  const result = await applyWorkplaceEvidence(admin as never, STUDENT_ID);
  assert.equal(result.status, "no_plan");
});

test("applyWorkplaceEvidence resets and persists a new curriculum version", async () => {
  const plan = makePlan(STUDENT_ID);
  const rows: ObservationRow[] = [
    {
      pseudonymous_id: PID,
      employer_id: EMPLOYER_ID,
      skill: "speaking",
      observation: "Call transcript shows mid-sentence stalls",
      created_at: "2030-01-01T00:00:00Z",
    },
    {
      pseudonymous_id: PID,
      employer_id: EMPLOYER_ID,
      skill: "writing",
      observation: "Draft shows register drift",
      created_at: "2030-01-01T00:00:00Z",
    },
  ];

  const admin = makeAdmin({
    plan,
    rows,
    studentEmail: pseudonymousEmail(PID),
  });

  const result = await applyWorkplaceEvidence(admin as never, STUDENT_ID);

  assert.equal(result.status, "reset");
  if (result.status !== "reset") return;
  assert.ok(result.to_version >= 2);
  assert.equal(result.trigger_type, "WORK_OBSERVATION");

  const joined = admin.log.join("|");
  assert.match(joined, /curricula\.load/);
  assert.match(joined, /students\.lookup/);
  assert.match(joined, /curricula\.supersede/);
  assert.match(joined, /curricula\.insert/);
  assert.match(joined, /lessons\.insert/);
  assert.match(joined, /resets\.insert/);
  assert.match(joined, /"trigger_type":"WORK_OBSERVATION"/);
});

test("applyWorkplaceEvidence does not reset when the evidence does not change gaps", async () => {
  const plan = makePlan(STUDENT_ID);
  const rows: ObservationRow[] = [
    {
      pseudonymous_id: PID,
      employer_id: EMPLOYER_ID,
      skill: "reading",
      observation: "Comprehension is steady",
      created_at: "2030-01-01T00:00:00Z",
    },
  ];

  const admin = makeAdmin({
    plan,
    rows,
    studentEmail: pseudonymousEmail(PID),
  });

  const result = await applyWorkplaceEvidence(admin as never, STUDENT_ID);
  assert.equal(result.status, "no_reset");
  assert.equal(admin.log.some((l) => l.startsWith("curricula.insert")), false);
});
