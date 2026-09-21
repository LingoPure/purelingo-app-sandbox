import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrgIntelligence,
  GAP_MARGIN,
  type RawAgentScore,
} from "@/lib/bpo/intelligence";
import { computeDelta, type ScoreSet } from "@/lib/bpo/delta-report";

const EMPLOYER = "employer-acme";
const TARGET = 700;

// Two agents, both teams/roles; baseline weak, trained strong → positive delta.
const roster = [
  { studentId: "s1", name: "Bui Thi Lan", role: "BPO Operator", team: "alpha" },
  { studentId: "s2", name: "Vo Ngoc Anh", role: "BPO Operator", team: "bravo" },
];

function rawScores(): RawAgentScore[] {
  return [
    { student_id: "s1", student_name: "Bui Thi Lan", role: "BPO Operator", team: "alpha", skill: "speaking", score: 600, target: TARGET },
    { student_id: "s1", student_name: "Bui Thi Lan", role: "BPO Operator", team: "alpha", skill: "writing", score: 540, target: TARGET },
    { student_id: "s2", student_name: "Vo Ngoc Anh", role: "BPO Operator", team: "bravo", skill: "speaking", score: 760, target: TARGET },
    { student_id: "s2", student_name: "Vo Ngoc Anh", role: "BPO Operator", team: "bravo", skill: "writing", score: 700, target: TARGET },
  ];
}

function emptyDelta() {
  return computeDelta({} as ScoreSet, {} as ScoreSet, []);
}

test("intelligence rollup produces role/team/overall capability", () => {
  const report = buildOrgIntelligence(EMPLOYER, rawScores(), emptyDelta());

  assert.equal(report.employer_id, EMPLOYER);
  assert.equal(report.overall_capability, 650); // (600+540+760+700)/4

  assert.equal(report.by_role.length, 1);
  assert.equal(report.by_role[0].metric, "BPO Operator");
  assert.equal(report.by_role[0].overall, 650);

  assert.equal(report.by_team.length, 2);
  const alpha = report.by_team.find((g) => g.metric === "alpha")!;
  assert.equal(alpha.overall, 570);
  const bravo = report.by_team.find((g) => g.metric === "bravo")!;
  assert.equal(bravo.overall, 730);
});

test("common gaps flag skills below target by GAP_MARGIN", () => {
  const report = buildOrgIntelligence(EMPLOYER, rawScores(), emptyDelta());

  const speaking = report.common_gaps.find((g) => g.skill === "speaking")!;
  // mean=(600+760)/2=680, target 700 → gap 20
  assert.equal(speaking.mean, 680);
  assert.equal(speaking.gap, 20);
  assert.equal(speaking.is_common_gap, false);

  const writing = report.common_gaps.find((g) => g.skill === "writing")!;
  // mean=(540+700)/2=620, gap 80
  assert.equal(writing.gap, 80);
  assert.equal(writing.is_common_gap, false);
});

test("large shortfall is flagged as a common gap and sorts first", () => {
  const scores = rawScores();
  scores.push(
    { student_id: "s3", student_name: "Pham Thanh Tam", role: "Manufacturing Sales Rep", team: "alpha", skill: "writing", score: 500, target: TARGET }
  );
  const report = buildOrgIntelligence(EMPLOYER, scores, emptyDelta());
  const writing = report.common_gaps.find((g) => g.skill === "writing")!;
  // mean=(540+700+500)/3=580, gap 120 — under GAP_MARGIN, so NOT a common gap
  assert.equal(writing.gap, 120);
  assert.equal(writing.is_common_gap, false);

  const bigGap = scores.map((s) => ({ ...s, score: 320 }));
  const bigReport = buildOrgIntelligence(EMPLOYER, bigGap, emptyDelta());
  const big = bigReport.common_gaps.find((g) => g.skill === "writing")!;
  assert.equal(big.is_common_gap, true);
  assert.ok(big.gap! > GAP_MARGIN);
});

test("training demand sorted lowest-first", () => {
  const scores: RawAgentScore[] = [
    { student_id: "s2", student_name: "Vo Ngoc Anh", role: "BPO Operator", team: "bravo", skill: "speaking", score: 760, target: TARGET },
    { student_id: "s1", student_name: "Bui Thi Lan", role: "BPO Operator", team: "alpha", skill: "speaking", score: 470, target: TARGET },
  ];
  const report = buildOrgIntelligence(EMPLOYER, scores, emptyDelta());
  assert.ok(report.training_demand[0].studentId === "s1");
  assert.ok(report.training_demand[1].studentId === "s2");
});

test("improvement trend surfaces employer + role delta", () => {
  const baseline = {
    s1: { speaking: { score: 600, source: "workplace" as const } },
    s2: { speaking: { score: 620, source: "workplace" as const } },
  };
  const trained = {
    s1: { speaking: { score: 800, source: "workplace_trained" as const } },
    s2: { speaking: { score: 820, source: "workplace_trained" as const } },
  };
  const delta = computeDelta(baseline as ScoreSet, trained as ScoreSet, roster);

  const report = buildOrgIntelligence(EMPLOYER, rawScores(), delta);
  assert.equal(report.improvement.employer, 200);
  assert.equal(report.improvement.by_role["BPO Operator"], 200);
});