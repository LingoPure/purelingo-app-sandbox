import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPlayerState, reducePlayerState } from "../../src/lib/whiteboard/player";

test("START moves idle -> playing(0) and reveals step 0", () => {
  const s = reducePlayerState(initialPlayerState(), { type: "START" }, 3, false);
  assert.strictEqual(s.status, "playing");
  assert.strictEqual(s.stepIndex, 0);
  assert.deepStrictEqual(s.revealedStepIndices, [0]);
});

test("STEP_FINISHED on a step with no check advances to the next step", () => {
  const playing = { status: "playing" as const, stepIndex: 0, revealedStepIndices: [0] };
  const s = reducePlayerState(playing, { type: "STEP_FINISHED" }, 3, false);
  assert.strictEqual(s.status, "playing");
  assert.strictEqual(s.stepIndex, 1);
  assert.deepStrictEqual(s.revealedStepIndices, [0, 1]);
});

test("STEP_FINISHED on a step with a quick_check stops in awaiting_check", () => {
  const playing = { status: "playing" as const, stepIndex: 0, revealedStepIndices: [0] };
  const s = reducePlayerState(playing, { type: "STEP_FINISHED" }, 3, true);
  assert.strictEqual(s.status, "awaiting_check");
  assert.strictEqual(s.stepIndex, 0, "must not advance until the check is answered");
});

test("CHECK_ANSWERED resumes playback from awaiting_check", () => {
  const awaiting = { status: "awaiting_check" as const, stepIndex: 0, revealedStepIndices: [0] };
  const s = reducePlayerState(awaiting, { type: "CHECK_ANSWERED" }, 3, true);
  assert.strictEqual(s.status, "playing");
  assert.strictEqual(s.stepIndex, 1);
});

test("finishing the last step moves to done", () => {
  const playing = { status: "playing" as const, stepIndex: 2, revealedStepIndices: [0, 1, 2] };
  const s = reducePlayerState(playing, { type: "STEP_FINISHED" }, 3, false);
  assert.strictEqual(s.status, "done");
});

test("STEP_BACK re-renders to the end state of the previous step, no reverse animation", () => {
  const playing = { status: "playing" as const, stepIndex: 2, revealedStepIndices: [0, 1, 2] };
  const s = reducePlayerState(playing, { type: "STEP_BACK" }, 3, false);
  assert.strictEqual(s.stepIndex, 1);
  assert.deepStrictEqual(s.revealedStepIndices, [0, 1]);
});

test("PAUSE then RESUME returns to playing at the same step", () => {
  const playing = { status: "playing" as const, stepIndex: 1, revealedStepIndices: [0, 1] };
  const paused = reducePlayerState(playing, { type: "PAUSE" }, 3, false);
  assert.strictEqual(paused.status, "paused");
  const resumed = reducePlayerState(paused, { type: "RESUME" }, 3, false);
  assert.strictEqual(resumed.status, "playing");
  assert.strictEqual(resumed.stepIndex, 1);
});

test("a zero-step script goes straight to done on START", () => {
  const s = reducePlayerState(initialPlayerState(), { type: "START" }, 0, false);
  assert.strictEqual(s.status, "done");
});
