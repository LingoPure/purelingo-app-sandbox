import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreToCefrBand,
  scoreToLp18,
  scoreToLp18PlacementScore90,
  LP18_PLACEMENT_SCORE_90,
  CEFR_TARGET_FLOOR,
} from "../../src/lib/scoring/rubric";

/**
 * Regression tests for the ISS-B fix (docs/audit/platform-state-2026-10-11.md
 * finding B): scoreToCefrBand and scoreToLp18 used to disagree for any score
 * above ~666.7 (e.g. 700 read "B2" from one, "C1.1" from the other, live, on
 * the dashboard and in the placement-report email). scoreToLp18 now derives
 * from scoreToCefrBand's own bands, so they cannot disagree by construction.
 */

test("scoreToLp18 never disagrees with scoreToCefrBand — the exact bug that shipped", () => {
  // These are the precise scores the audit found disagreeing before the fix.
  for (const score of [700, 750, 850]) {
    const band = scoreToCefrBand(score);
    const lp18 = scoreToLp18(score);
    assert.ok(
      lp18.startsWith(band),
      `score ${score}: scoreToCefrBand says "${band}" but scoreToLp18 says "${lp18}"`
    );
  }
});

test("scoreToLp18 agrees with scoreToCefrBand across the whole 0-1000 range", () => {
  for (let score = 0; score <= 1000; score += 7) {
    const band = scoreToCefrBand(score);
    const lp18 = scoreToLp18(score);
    assert.ok(lp18.startsWith(band), `score ${score}: band "${band}" vs lp18 "${lp18}"`);
  }
});

test("scoreToLp18 splits each CEFR band into exactly three equal thirds", () => {
  // A1/A2/B1/B2 are 200 wide -> thirds at +66.7/+133.3. C1/C2 are 100 wide -> thirds at +33.3/+66.7.
  assert.strictEqual(scoreToLp18(0), "A1.1");
  assert.strictEqual(scoreToLp18(66), "A1.1");
  assert.strictEqual(scoreToLp18(67), "A1.2");
  assert.strictEqual(scoreToLp18(133), "A1.2");
  assert.strictEqual(scoreToLp18(134), "A1.3");
  assert.strictEqual(scoreToLp18(199), "A1.3");

  assert.strictEqual(scoreToLp18(600), "B2.1");
  assert.strictEqual(scoreToLp18(700), "B2.2"); // the audit's headline example — was "C1.1"
  assert.strictEqual(scoreToLp18(750), "B2.3"); // was "C1.2"
  assert.strictEqual(scoreToLp18(799), "B2.3");

  assert.strictEqual(scoreToLp18(800), "C1.1");
  assert.strictEqual(scoreToLp18(850), "C1.2"); // was "C2.1"
  assert.strictEqual(scoreToLp18(899), "C1.3");

  assert.strictEqual(scoreToLp18(900), "C2.1");
  assert.strictEqual(scoreToLp18(1000), "C2.3");
});

test("LP18_PLACEMENT_SCORE_90 matches the documented, non-linear teacher-guide table", () => {
  // Spot-check the documented jumps: 5-pt steps through A1-B1, a 10-pt jump
  // at B1.3->B2.1 and B2.3->C1.1, and 1-pt steps across C2.
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["A1.1"], 5);
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["B1.3"], 45);
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["B2.1"], 55); // +10, not +5
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["B2.3"], 65);
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["C1.1"], 75); // +10, not +5
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["C2.1"], 88);
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["C2.2"], 89); // +1, not +5
  assert.strictEqual(LP18_PLACEMENT_SCORE_90["C2.3"], 90);
});

test("scoreToLp18PlacementScore90 composes scoreToLp18 with the documented table", () => {
  assert.strictEqual(scoreToLp18(700), "B2.2");
  assert.strictEqual(scoreToLp18PlacementScore90(700), 60); // B2.2
  assert.strictEqual(scoreToLp18PlacementScore90(1000), 90);
});

test("CEFR_TARGET_FLOOR boundaries are unchanged by the fix (they were already correct)", () => {
  assert.deepStrictEqual(CEFR_TARGET_FLOOR, {
    A1: 0,
    A2: 200,
    B1: 400,
    B2: 600,
    C1: 800,
    C2: 900,
  });
});
