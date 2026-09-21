import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDelta,
  type ScoreSet,
} from "@/lib/bpo/delta-report";

const roster = [
  { studentId: "s1", name: "Bui Thi Lan", role: "BPO Operator", team: "alpha" },
  { studentId: "s2", name: "Pham Thanh Tam", role: "Manufacturing Sales Rep", team: "alpha" },
  { studentId: "s3", name: "Vo Ngoc Anh", role: "BPO Operator", team: "bravo" },
];

function scoreSet(rows: Array<[string, number]>): ScoreSet {
  const set: ScoreSet = {};
  for (const [studentId, score] of rows) {
    const skill = "speaking";
    set[studentId] ??= {};
    set[studentId][skill] = { score, source: "workplace" };
  }
  return set;
}

test("training improves mapped skills (positive overall delta)", () => {
  const baseline = scoreSet([["s1", 500], ["s2", 620], ["s3", 480]]);
  const trained = scoreSet([["s1", 720], ["s2", 780], ["s3", 700]]);

  const report = computeDelta(baseline, trained, roster);
  assert.equal(report.agents.length, 3);

  const deltas = report.agents.map((a) => a.overall);
  assert.ok(deltas.every((d) => d! > 0), `expected positive deltas, got ${deltas}`);

  assert.equal(report.byRole["BPO Operator"]!.improvement, 220);
  assert.equal(report.byRole["Manufacturing Sales Rep"]!.improvement, 160);
  assert.equal(report.employerImprovement, 190);
});

test("untrained agents show no delta change for that skill", () => {
  const baseline = scoreSet([["s1", 500]]);
  const report = computeDelta(baseline, {}, roster);
  const s1 = report.agents.find((a) => a.studentId === "s1")!;
  assert.equal(s1.skills[0].baseline, 500);
  assert.equal(s1.skills[0].trained, null);
  assert.equal(s1.skills[0].delta, null);
  assert.equal(s1.overall, null);
});

test("empty roster yields empty report", () => {
  const report = computeDelta({}, {}, []);
  assert.deepEqual(report.agents, []);
  assert.deepEqual(report.byRole, {});
  assert.equal(report.employerImprovement, null);
});

test("per-skill delta equals raw difference", () => {
  const baseline = scoreSet([["s1", 520]]);
  const trained = scoreSet([["s1", 840]]);
  const report = computeDelta(baseline, trained, roster.filter((r) => r.studentId === "s1"));
  const s1 = report.agents[0];
  assert.equal(s1.skills[0].baseline, 520);
  assert.equal(s1.skills[0].trained, 840);
  assert.equal(s1.skills[0].delta, 320);
});