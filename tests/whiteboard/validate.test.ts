import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLessonScript } from "../../src/lib/whiteboard/validate";
import type { LessonScript } from "../../src/lib/whiteboard/schema";

function baseScript(overrides: Partial<LessonScript> = {}): LessonScript {
  return {
    id: "test-lesson",
    title: "Test lesson",
    lp18Sublevel: "LP18_SUBLEVEL_TBD",
    taxonomyRefs: [],
    provenance: { source: "static", schemaVersion: "1.0.0" },
    steps: [
      {
        id: "step-1",
        narration: "Here is the first idea.",
        actions: [{ type: "heading", id: "h1", text: "Intro", level: 1 }],
      },
    ],
    ...overrides,
  };
}

test("a valid static script passes", () => {
  const result = validateLessonScript(baseScript());
  assert.deepStrictEqual(result, { ok: true });
});

test("rejects an invented percentage/statistic claim outside a source_embed", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Only the 5% elite ever reach this level.",
        actions: [{ type: "heading", id: "h1", text: "Intro", level: 1 }],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /percentage\/statistic/.test(e)));
  }
});

test("rejects a disallowed/fabricated product noun", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "This course gives you a six-dimension profile.",
        actions: [{ type: "heading", id: "h1", text: "Intro", level: 1 }],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /disallowed\/fabricated term/.test(e)));
  }
});

test("rejects an unsupported CEFR-level claim about the learner", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Great news — you are C1 now.",
        actions: [{ type: "heading", id: "h1", text: "Intro", level: 1 }],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /CEFR-level claim/.test(e)));
  }
});

test("rejects a highlight whose match occurs more than once", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Say it.",
        actions: [
          { type: "text_block", id: "t1", spans: [{ text: "go go go now" }] },
          { type: "highlight", targetId: "t1", match: "go" },
        ],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /occurs 3 times/.test(e)));
  }
});

test("rejects a highlight that targets an unintroduced block", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Say it.",
        actions: [{ type: "highlight", targetId: "ghost", match: "x" }],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /has not been introduced yet/.test(e)));
  }
});

test("rejects a quick_check that is not the last action in its step", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Check it.",
        actions: [
          { type: "quick_check", id: "q1", prompt: "Pick one", mode: "choice", options: ["A", "B"] },
          { type: "heading", id: "h1", text: "After", level: 2 },
        ],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /must be the last action/.test(e)));
  }
});

test("rejects a source_embed referencing an unknown sourceId", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Here is the rule.",
        actions: [{ type: "source_embed", id: "s1", sourceId: "does-not-exist" }],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /unknown sourceId/.test(e)));
  }
});

test("rejects duplicate block ids anywhere in the script", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "One.",
        actions: [{ type: "heading", id: "dup", text: "A", level: 1 }],
      },
      {
        id: "step-2",
        narration: "Two.",
        actions: [{ type: "heading", id: "dup", text: "B", level: 1 }],
      },
    ],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /duplicate id "dup"/.test(e)));
  }
});

test("rejects an invented taxonomy ref outside the real skill-key enum", () => {
  const script = baseScript({
    taxonomyRefs: ["invented-dimension"] as unknown as LessonScript["taxonomyRefs"],
  });
  const result = validateLessonScript(script);
  assert.strictEqual(result.ok, false);
});
