import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLessonScript } from "../../src/lib/whiteboard/validate";
import { computeLayout } from "../../src/lib/whiteboard/layout";
import lessonJson from "../../src/content/lessons/repair-reformulation.json";

/**
 * The Phase 1 static lesson must validate and lay out cleanly — this is
 * what the brief means by "static lessons at build time" (§6): this test
 * is that build-time gate, run in CI alongside the other unit tests.
 */

test("repair-reformulation.json validates against the schema + content lint", () => {
  const result = validateLessonScript(lessonJson);
  assert.deepStrictEqual(result, { ok: true });
});

test("repair-reformulation.json uses every block type at least once", () => {
  const seen = new Set<string>();
  for (const step of lessonJson.steps) {
    for (const action of step.actions) seen.add(action.type);
  }
  const required = [
    "heading",
    "text_block",
    "definition_list",
    "table",
    "contrast",
    "phrase_bank",
    "source_embed",
    "highlight",
    "circle",
    "quick_check",
  ];
  for (const type of required) {
    assert.ok(seen.has(type), `missing block type "${type}" in the Phase 1 lesson`);
  }
});

test("repair-reformulation.json lays out without throwing, using a synthetic measurer", () => {
  const layout = computeLayout(lessonJson as never, {
    measureText: (text) => text.length * 7,
  });
  assert.ok(Object.keys(layout.blocks).length > 0);
  assert.strictEqual(layout.marks.length, 2, "expects the one highlight + one circle in step 4");
});
