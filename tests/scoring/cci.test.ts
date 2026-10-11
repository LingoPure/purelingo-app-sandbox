import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeCommunicationConvergenceIndex,
  cciToBand,
  CCI_BANDS,
} from "../../src/lib/scoring/cci";

test("returns null when no core signal is assessed", () => {
  assert.strictEqual(computeCommunicationConvergenceIndex({}), null);
  assert.strictEqual(
    computeCommunicationConvergenceIndex({ listening: null, reading: undefined }),
    null
  );
});

test("a single assessed signal returns that value unchanged (convergence needs >=2 points)", () => {
  assert.strictEqual(computeCommunicationConvergenceIndex({ listening: 650 }), 650);
});

test("an evenly-converged profile scores at or above its own mean", () => {
  const cci = computeCommunicationConvergenceIndex({
    listening: 700,
    writing: 700,
    grammar: 700,
  });
  assert.ok(cci != null);
  assert.ok(cci >= 700, `expected a convergence bonus, got ${cci}`);
});

test("a spread-out profile scores below its own mean", () => {
  const mean = (850 + 700 + 500) / 3;
  const cci = computeCommunicationConvergenceIndex({
    listening: 850,
    live_interaction: 700,
    grammar: 500,
  });
  assert.ok(cci != null);
  assert.ok(cci < mean, `expected a spread penalty below mean ${mean}, got ${cci}`);
});

test("more spread produces a lower score than less spread, for the same mean", () => {
  const tight = computeCommunicationConvergenceIndex({
    listening: 690,
    writing: 700,
    grammar: 710,
  });
  const wide = computeCommunicationConvergenceIndex({
    listening: 500,
    writing: 700,
    grammar: 900,
  });
  assert.ok(tight != null && wide != null);
  assert.ok(tight > wide, `expected tight (${tight}) > wide (${wide})`);
});

test("is a pure function of its input — deterministic", () => {
  const input = { listening: 620, reading: 580, writing: 710, grammar: 490, live_interaction: 650 };
  const a = computeCommunicationConvergenceIndex(input);
  const b = computeCommunicationConvergenceIndex(input);
  assert.strictEqual(a, b);
});

test("ignores skills outside the 5 documented core signals", () => {
  const withExtra = computeCommunicationConvergenceIndex({
    listening: 700,
    writing: 700,
    grammar: 700,
    // @ts-expect-error -- deliberately passing an out-of-scope key to prove it's ignored
    speaking: 0,
  });
  const withoutExtra = computeCommunicationConvergenceIndex({
    listening: 700,
    writing: 700,
    grammar: 700,
  });
  assert.strictEqual(withExtra, withoutExtra);
});

test("result is always clamped to [0, 1000]", () => {
  const cci = computeCommunicationConvergenceIndex({
    listening: 1000,
    writing: 1000,
    grammar: 1000,
  });
  assert.ok(cci != null && cci <= 1000);
});

test("cciToBand covers the full 0-1000 range with the documented band labels", () => {
  assert.strictEqual(cciToBand(0), "Survival");
  assert.strictEqual(cciToBand(149), "Survival");
  assert.strictEqual(cciToBand(150), "Functional");
  assert.strictEqual(cciToBand(600), "Stable Professional");
  assert.strictEqual(cciToBand(950), "Strategic Mastery");
  assert.strictEqual(cciToBand(1000), "Strategic Mastery");
});

test("CCI_BANDS boundaries are contiguous and cover 0-1000 with no gaps", () => {
  for (let i = 1; i < CCI_BANDS.length; i++) {
    assert.strictEqual(CCI_BANDS[i].min, CCI_BANDS[i - 1].max + 1);
  }
  assert.strictEqual(CCI_BANDS[0].min, 0);
  assert.strictEqual(CCI_BANDS[CCI_BANDS.length - 1].max, 1000);
});
