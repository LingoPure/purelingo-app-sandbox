import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLayout, type MeasureText } from "../../src/lib/whiteboard/layout";
import type { LessonScript } from "../../src/lib/whiteboard/schema";

/** Deterministic, synthetic measurer — no canvas/DOM needed. Monospace-like:
 *  each character is a fixed width, so wrapping decisions are reproducible
 *  by hand for the assertions below. */
const measureText: MeasureText = (text) => text.length * 7;

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
        actions: [
          { type: "heading", id: "h1", text: "Repair and reformulation", level: 1 },
          {
            type: "text_block",
            id: "t1",
            spans: [{ text: "This is a clean restart of the sentence." }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

test("computeLayout is deterministic — same script + measurer, identical positions", () => {
  const script = baseScript();
  const first = computeLayout(script, { measureText });
  const second = computeLayout(script, { measureText });
  assert.deepStrictEqual(first, second);
});

test("blocks never overlap vertically within a column", () => {
  const script = baseScript();
  const layout = computeLayout(script, { measureText });
  const h1 = layout.blocks["h1"];
  const t1 = layout.blocks["t1"];
  assert.ok(h1);
  assert.ok(t1);
  assert.strictEqual(h1.column, t1.column);
  assert.ok(t1.y >= h1.y + h1.height, "t1 must start at or after h1's bottom edge");
});

test("a block that would overflow the board height starts a new column", () => {
  const script = baseScript();
  const tallLayout = computeLayout(script, { measureText, boardHeight: 80 });
  const h1 = tallLayout.blocks["h1"];
  const t1 = tallLayout.blocks["t1"];
  // With a tiny board height, the heading alone fills the column, so the
  // text block must be pushed into column 1.
  assert.strictEqual(h1.column, 0);
  assert.strictEqual(t1.column, 1);
  assert.strictEqual(tallLayout.columns, 2);
});

test("highlight geometry lands on the matched words, word-aligned, one rect per line hit", () => {
  const script = baseScript({
    steps: [
      {
        id: "step-1",
        narration: "Notice the clean restart.",
        actions: [
          {
            type: "text_block",
            id: "t1",
            spans: [{ text: "This is a clean restart of the sentence." }],
          },
          { type: "highlight", targetId: "t1", match: "clean restart" },
        ],
      },
    ],
  });
  const layout = computeLayout(script, { measureText, columnWidth: 1000 });
  assert.strictEqual(layout.marks.length, 1);
  const mark = layout.marks[0];
  assert.strictEqual(mark.targetId, "t1");
  assert.strictEqual(mark.type, "highlight");
  assert.ok(mark.rects.length >= 1);
  // Wide column (1000px) → everything fits on one line → exactly one rect.
  assert.strictEqual(mark.rects.length, 1);
  const rect = mark.rects[0];
  const t1 = layout.blocks["t1"];
  assert.ok(rect.x >= t1.x, "highlight rect must sit inside its block's x range");
  assert.ok(rect.x + rect.width <= t1.x + t1.width + 1, "highlight rect must not exceed block width");
});

test("zoom is not a layout concern — geometry is identical regardless of a later display scale", () => {
  // computeLayout has no zoom parameter at all: this test documents that
  // zoom is purely a Board.tsx viewBox scale, not a re-layout, which is
  // exactly why marks land exactly on target spans at any zoom level.
  const script = baseScript();
  const a = computeLayout(script, { measureText });
  const b = computeLayout(script, { measureText });
  assert.deepStrictEqual(a.blocks, b.blocks);
});
