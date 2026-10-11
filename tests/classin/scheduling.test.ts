import { test } from "node:test";
import assert from "node:assert/strict";
import { decideNextClassSlot, MAX_LOOKAHEAD_DAYS } from "../../src/lib/classin/scheduling";

// A fixed Monday so weekday arithmetic is deterministic across runs.
const MONDAY = new Date("2026-11-02T00:00:00Z");

test("picks the next day when nothing else is scheduled and it's a weekday", () => {
  const slot = decideNextClassSlot([], MONDAY);
  assert.ok(slot);
  assert.strictEqual(slot!.getUTCDay(), 2); // Tuesday
});

test("never picks a Saturday or Sunday", () => {
  for (let i = 0; i < 10; i++) {
    const start = new Date(MONDAY);
    start.setUTCDate(start.getUTCDate() + i);
    const slot = decideNextClassSlot([], start);
    assert.ok(slot);
    const day = slot!.getUTCDay();
    assert.ok(day !== 0 && day !== 6, `picked a weekend day: ${slot!.toISOString()}`);
  }
});

test("skips a day that already has an upcoming scheduled session", () => {
  const tuesday = new Date(MONDAY);
  tuesday.setUTCDate(tuesday.getUTCDate() + 1);
  tuesday.setUTCHours(2, 0, 0, 0);

  const slot = decideNextClassSlot([{ scheduledAt: tuesday.toISOString() }], MONDAY);
  assert.ok(slot);
  assert.notStrictEqual(slot!.toISOString().slice(0, 10), tuesday.toISOString().slice(0, 10));
});

test("never schedules further out than MAX_LOOKAHEAD_DAYS", () => {
  // Block every weekday in the lookahead window — nothing should be left.
  const existing = [];
  for (let i = 1; i <= MAX_LOOKAHEAD_DAYS; i++) {
    const d = new Date(MONDAY);
    d.setUTCDate(d.getUTCDate() + i);
    existing.push({ scheduledAt: d.toISOString() });
  }
  const slot = decideNextClassSlot(existing, MONDAY);
  assert.strictEqual(slot, null);
});

test("is deterministic — same inputs, same output", () => {
  const a = decideNextClassSlot([], MONDAY);
  const b = decideNextClassSlot([], MONDAY);
  assert.strictEqual(a?.toISOString(), b?.toISOString());
});
