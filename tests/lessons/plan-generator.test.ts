import { test } from "node:test";
import assert from "node:assert/strict";
import { generateLessonPlan, type PlanRecommendation } from "../../src/lib/lessons/plan-generator";

/**
 * Regression tests for the three-tier modality ladder (locked 2026-10):
 * voice-native skills (speaking/listening/grammar/live_interaction) default
 * to an ai_voice recommendation, escalating to a live class only once the
 * gap is wide enough that drilling alone won't close it. Written skills
 * (writing/reading) are unaffected — they stay on micro_lesson.
 */

type MockRow = Record<string, unknown>;

function mockSupabase(gapScores: MockRow[]) {
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
          return Promise.resolve({ data: null }); // no role assigned -> flat 800 baselines
        },
        then(resolve: (v: { data: MockRow[] }) => void) {
          resolve({ data: table === "gap_scores" ? gapScores : [] });
        },
      };
      return chain;
    },
  };
}

function findRecs(recs: PlanRecommendation[], skill: string) {
  return recs.filter((r) => r.skill === skill);
}

test("a medium gap on a voice-native skill recommends ai_voice, not class", async () => {
  // listening: baseline 800, score 650 -> gap 150, below the 200 escalation threshold.
  const supabase = mockSupabase([
    { skill: "listening", score: 650, target: 800, is_canonical: true },
  ]);
  const recs = await generateLessonPlan(supabase as never, "student-1");
  const listening = findRecs(recs, "listening");
  assert.strictEqual(listening.length, 1);
  assert.strictEqual(listening[0].kind, "ai_voice");
});

test("a large gap on a voice-native skill recommends BOTH ai_voice and an escalated class", async () => {
  // grammar: baseline 800, score 500 -> gap 300, over the 200 escalation threshold.
  const supabase = mockSupabase([
    { skill: "grammar", score: 500, target: 800, is_canonical: true },
  ]);
  const recs = await generateLessonPlan(supabase as never, "student-2");
  const grammar = findRecs(recs, "grammar");
  assert.strictEqual(grammar.length, 2, "expected the ai_voice rec plus the class escalation");
  const kinds = grammar.map((r) => r.kind).sort();
  assert.deepStrictEqual(kinds, ["ai_voice", "class"]);
});

test("a written skill (writing) is unaffected — still micro_lesson, no ai_voice tier", async () => {
  // Every skill scored (none hit the "no score yet" branch) so writing's
  // own recommendation can't be merged with another skill's probe via
  // consolidate()'s shared-lessonType collapsing (e.g. reading, which
  // also maps to email_sprint).
  const supabase = mockSupabase([
    { skill: "writing", score: 650, target: 800, is_canonical: true }, // gap 150 -> below the 200 class-escalation threshold
    { skill: "reading", score: 900, target: 800, is_canonical: true }, // at/above baseline -> no rec
    { skill: "speaking", score: 900, target: 800, is_canonical: true },
    { skill: "listening", score: 900, target: 800, is_canonical: true },
    { skill: "grammar", score: 900, target: 800, is_canonical: true },
    { skill: "live_interaction", score: 900, target: 800, is_canonical: true },
  ]);
  const recs = await generateLessonPlan(supabase as never, "student-3");
  const writing = findRecs(recs, "writing");
  assert.strictEqual(writing.length, 1);
  assert.strictEqual(writing[0].kind, "micro_lesson");
  assert.ok(writing.every((r) => r.kind !== "ai_voice"));
});

test("ai_voice recommendations link to /practice with the skill and source=plan", async () => {
  const supabase = mockSupabase([
    { skill: "speaking", score: 600, target: 800, is_canonical: true },
  ]);
  const recs = await generateLessonPlan(supabase as never, "student-4");
  const speaking = findRecs(recs, "speaking").find((r) => r.kind === "ai_voice");
  assert.ok(speaking);
  assert.strictEqual(speaking!.ctaHref, "/practice?skill=speaking&source=plan");
});

test("an unassessed voice-native skill gets an optional ai_voice probe, not a class probe", async () => {
  const supabase = mockSupabase([]); // nothing scored yet
  const recs = await generateLessonPlan(supabase as never, "student-5");
  const liveInteraction = findRecs(recs, "live_interaction");
  assert.strictEqual(liveInteraction.length, 1);
  assert.strictEqual(liveInteraction[0].kind, "ai_voice");
  assert.strictEqual(liveInteraction[0].priority, "optional");
});
