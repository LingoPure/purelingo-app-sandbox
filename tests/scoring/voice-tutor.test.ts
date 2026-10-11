import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateUsageCap, DAILY_ON_DEMAND_CAP } from "../../src/lib/voice-tutor/usage-cap";
import { VoiceTutorScoreSchema } from "../../src/lib/scoring/voice-tutor-rubric";

test("evaluateUsageCap allows sessions under the daily cap", () => {
  const result = evaluateUsageCap(0);
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.cap, DAILY_ON_DEMAND_CAP);
});

test("evaluateUsageCap denies at the cap, with a clear reason", () => {
  const result = evaluateUsageCap(DAILY_ON_DEMAND_CAP);
  assert.strictEqual(result.allowed, false);
  assert.ok(result.reason && result.reason.length > 0);
});

test("evaluateUsageCap denies past the cap too (defensive, not just at the boundary)", () => {
  const result = evaluateUsageCap(DAILY_ON_DEMAND_CAP + 5);
  assert.strictEqual(result.allowed, false);
});

test("evaluateUsageCap respects a custom cap", () => {
  assert.strictEqual(evaluateUsageCap(2, 3).allowed, true);
  assert.strictEqual(evaluateUsageCap(3, 3).allowed, false);
});

test("VoiceTutorScoreSchema accepts a well-formed score", () => {
  const parsed = VoiceTutorScoreSchema.safeParse({
    skill: { score: 650, cefr_band: "B2", evidence: "Recovered cleanly from a hesitation mid-sentence." },
    coach_note: "Good recovery — try that phrase again at full speed next time.",
  });
  assert.strictEqual(parsed.success, true);
});

test("VoiceTutorScoreSchema rejects a score outside 0-1000", () => {
  const parsed = VoiceTutorScoreSchema.safeParse({
    skill: { score: 1500, cefr_band: "C2", evidence: "x" },
    coach_note: "x",
  });
  assert.strictEqual(parsed.success, false);
});

test("VoiceTutorScoreSchema requires a coach_note", () => {
  const parsed = VoiceTutorScoreSchema.safeParse({
    skill: { score: 500, cefr_band: "B1", evidence: "x" },
  });
  assert.strictEqual(parsed.success, false);
});
