import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAllRules,
  programmeKickoff,
  programmeCadenceBehind,
  weekJustEndedFor,
  streakAtRisk,
  type SnapshotStudent,
} from "../../src/lib/nudges/rules";

function baseStudent(overrides: Partial<SnapshotStudent> = {}): SnapshotStudent {
  return {
    id: "s1",
    email: "s1@x.com",
    name: "Test Student",
    target_level: "B2",
    discovery_status: "complete",
    averageScore: 60,
    streak_days: 0,
    last_active_date: null,
    nextClassAt: null,
    programme: null,
    lastCompletedWeekByTarget: null,
    ...overrides,
  };
}

const ACTIVE_VOICE_TARGET = {
  skill: "live_interaction",
  label: "Live Interaction",
  kind: "ai_voice" as const,
  timesPerWeek: 3,
  ctaHref: "/practice?skill=live_interaction&source=kickoff",
};

test("weekJustEndedFor: null on a non-boundary day", () => {
  assert.equal(weekJustEndedFor("2026-05-01T00:00:00Z", "2026-05-04"), null);
});

test("weekJustEndedFor: null on committedAt's own day (day 0)", () => {
  assert.equal(weekJustEndedFor("2026-05-01T00:00:00Z", "2026-05-01"), null);
});

test("weekJustEndedFor: week 1 on day 7", () => {
  assert.equal(weekJustEndedFor("2026-04-24T00:00:00Z", "2026-05-01"), 1);
});

test("weekJustEndedFor: week 2 on day 14", () => {
  assert.equal(weekJustEndedFor("2026-04-24T00:00:00Z", "2026-05-08"), 2);
});

test("programmeKickoff: fires once for a student with an un-kickoffed active programme", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-05-01T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [ACTIVE_VOICE_TARGET],
      kickoffNudgeSentAt: null,
      lastCadenceNudgeWeek: null,
    },
  });
  const candidates = programmeKickoff({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].rule, "programme_kickoff");
  assert.equal(candidates[0].ctaHref, ACTIVE_VOICE_TARGET.ctaHref);
});

test("programmeKickoff: does not fire once kickoffNudgeSentAt is set", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-05-01T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [ACTIVE_VOICE_TARGET],
      kickoffNudgeSentAt: "2026-05-01T12:00:00Z",
      lastCadenceNudgeWeek: null,
    },
  });
  const candidates = programmeKickoff({ today: "2026-05-02", students: [student] });
  assert.equal(candidates.length, 0);
});

test("programmeKickoff: does not fire without an active programme", () => {
  const candidates = programmeKickoff({ today: "2026-05-01", students: [baseStudent()] });
  assert.equal(candidates.length, 0);
});

test("programmeCadenceBehind: fires on the exact day a week closes short of target", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-04-24T00:00:00Z", // exactly 7 days before today
      totalWeeks: 8,
      skillTargets: [{ ...ACTIVE_VOICE_TARGET, timesPerWeek: 3 }],
      kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
      lastCadenceNudgeWeek: null,
    },
    lastCompletedWeekByTarget: { "ai_voice:live_interaction": 1 }, // short of 3
  });
  const candidates = programmeCadenceBehind({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].rule, "programme_cadence_behind");
  assert.match(candidates[0].body, /Live Interaction/);
});

test("programmeCadenceBehind: does not fire when the target was met", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-04-24T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [{ ...ACTIVE_VOICE_TARGET, timesPerWeek: 3 }],
      kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
      lastCadenceNudgeWeek: null,
    },
    lastCompletedWeekByTarget: { "ai_voice:live_interaction": 3 },
  });
  const candidates = programmeCadenceBehind({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 0);
});

test("programmeCadenceBehind: does not fire on a non-boundary day even if behind", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-04-24T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [{ ...ACTIVE_VOICE_TARGET, timesPerWeek: 3 }],
      kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
      lastCadenceNudgeWeek: null,
    },
    lastCompletedWeekByTarget: { "ai_voice:live_interaction": 0 },
  });
  const candidates = programmeCadenceBehind({ today: "2026-04-28", students: [student] });
  assert.equal(candidates.length, 0);
});

test("programmeCadenceBehind: does not re-fire for a week already nudged", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-04-24T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [{ ...ACTIVE_VOICE_TARGET, timesPerWeek: 3 }],
      kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
      lastCadenceNudgeWeek: 1, // week 1 already handled
    },
    lastCompletedWeekByTarget: { "ai_voice:live_interaction": 0 },
  });
  const candidates = programmeCadenceBehind({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 0);
});

test("programmeCadenceBehind: does not fire once the programme has run its course", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-04-24T00:00:00Z",
      totalWeeks: 1, // week 1 is the whole programme
      skillTargets: [{ ...ACTIVE_VOICE_TARGET, timesPerWeek: 3 }],
      kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
      lastCadenceNudgeWeek: 1,
    },
    lastCompletedWeekByTarget: { "ai_voice:live_interaction": 0 },
  });
  // Day 14 would be "week 2", past totalWeeks=1.
  const candidates = programmeCadenceBehind({ today: "2026-05-08", students: [student] });
  assert.equal(candidates.length, 0);
});

test("programmeCadenceBehind: a class-kind shortfall never says 'behind'", () => {
  const student = baseStudent({
    programme: {
      committedAt: "2026-04-24T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [
        {
          skill: "live_interaction",
          label: "Live Interaction",
          kind: "class",
          timesPerWeek: 1,
          ctaHref: "/dashboard#schedule-class",
        },
      ],
      kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
      lastCadenceNudgeWeek: null,
    },
    lastCompletedWeekByTarget: { "class:live_interaction": 0 },
  });
  const candidates = programmeCadenceBehind({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 1);
  assert.doesNotMatch(candidates[0].body.toLowerCase(), /behind/);
  assert.match(candidates[0].body, /check your schedule/i);
});

test("regression: streakAtRisk is unaffected by the new SnapshotStudent fields", () => {
  const student = baseStudent({
    streak_days: 5,
    last_active_date: "2026-04-30",
  });
  const candidates = streakAtRisk({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].rule, "streak_at_risk");
});

test("evaluateAllRules: programme_kickoff outranks streak/inactivity rules, never collides fatally", () => {
  const student = baseStudent({
    streak_days: 0,
    last_active_date: "2026-04-20", // would also qualify for inactivity_5d
    programme: {
      committedAt: "2026-05-01T00:00:00Z",
      totalWeeks: 8,
      skillTargets: [ACTIVE_VOICE_TARGET],
      kickoffNudgeSentAt: null,
      lastCadenceNudgeWeek: null,
    },
  });
  const candidates = evaluateAllRules({ today: "2026-05-01", students: [student] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].rule, "programme_kickoff");
});
