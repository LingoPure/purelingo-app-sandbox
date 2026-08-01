/**
 * Tests for src/lib/hr/dates.ts.
 *
 * Uses node:test rather than a test framework, deliberately: the HR module is
 * built to be lifted into a repo whose tooling we do not control, and node:test
 * ships with Node itself. One less thing to port.
 *
 * Run: npm run test:hr
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isDateOnly,
  todayInTimeZone,
  isoDayOfWeek,
  addDays,
  eachDate,
  calendarDaysBetween,
  yearOf,
  leaveYearOf,
} from "../../src/lib/hr/dates";

const ICT = "Asia/Ho_Chi_Minh";

describe("isDateOnly", () => {
  test("accepts a well-formed calendar date", () => {
    assert.equal(isDateOnly("2026-08-01"), true);
    assert.equal(isDateOnly("2024-02-29"), true, "2024 is a leap year");
  });

  test("rejects malformed strings", () => {
    for (const bad of ["2026-8-1", "01-08-2026", "2026/08/01", "", "today", "2026-08-01T00:00:00Z"]) {
      assert.equal(isDateOnly(bad), false, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });

  test("rejects dates that do not exist", () => {
    // The trap: Date rolls 2026-02-30 forward to 2026-03-02 rather than
    // erroring, so a naive parse would silently accept it.
    assert.equal(isDateOnly("2026-02-30"), false);
    assert.equal(isDateOnly("2026-13-01"), false);
    assert.equal(isDateOnly("2025-02-29"), false, "2025 is not a leap year");
  });

  test("rejects non-strings", () => {
    assert.equal(isDateOnly(null), false);
    assert.equal(isDateOnly(20260801), false);
    assert.equal(isDateOnly(new Date()), false);
  });
});

describe("todayInTimeZone — the UTC+7 trap", () => {
  test("returns the Vietnam date, not the UTC date, in the overlap window", () => {
    // 2026-08-01 18:30 UTC is 2026-08-02 01:30 in Ho Chi Minh City.
    // A system trusting UTC would say it is still the 1st, and would show the
    // wrong "who is off today" for seven hours every single day.
    const instant = new Date("2026-08-01T18:30:00Z");
    assert.equal(todayInTimeZone(ICT, instant), "2026-08-02");
    assert.equal(todayInTimeZone("UTC", instant), "2026-08-01");
  });

  test("agrees with UTC outside the overlap window", () => {
    const instant = new Date("2026-08-01T09:00:00Z"); // 16:00 ICT
    assert.equal(todayInTimeZone(ICT, instant), "2026-08-01");
    assert.equal(todayInTimeZone("UTC", instant), "2026-08-01");
  });

  test("rolls the year at Vietnam midnight, not UTC midnight", () => {
    const nye = new Date("2026-12-31T17:30:00Z"); // 2027-01-01 00:30 ICT
    assert.equal(todayInTimeZone(ICT, nye), "2027-01-01");
    assert.equal(
      yearOf(todayInTimeZone(ICT, nye)),
      2027,
      "a leave year must turn over on local midnight"
    );
  });
});

describe("isoDayOfWeek", () => {
  test("maps Monday through Sunday to 1..7", () => {
    // 2026-08-03 is a Monday.
    const expected: Array<[string, number]> = [
      ["2026-08-03", 1],
      ["2026-08-04", 2],
      ["2026-08-05", 3],
      ["2026-08-06", 4],
      ["2026-08-07", 5],
      ["2026-08-08", 6],
      ["2026-08-09", 7],
    ];
    for (const [date, dow] of expected) {
      assert.equal(isoDayOfWeek(date), dow, `${date} should be ISO day ${dow}`);
    }
  });

  test("Sunday is 7, never 0", () => {
    // The default JS convention is 0 for Sunday, which would silently fail
    // every `working_days` membership test since the array uses 1..7.
    assert.equal(isoDayOfWeek("2026-08-09"), 7);
  });

  test("rejects a malformed date rather than guessing", () => {
    assert.throws(() => isoDayOfWeek("2026-8-3"), /YYYY-MM-DD/);
  });
});

describe("addDays", () => {
  test("moves forward and backward", () => {
    assert.equal(addDays("2026-08-01", 1), "2026-08-02");
    assert.equal(addDays("2026-08-01", -1), "2026-07-31");
    assert.equal(addDays("2026-08-01", 0), "2026-08-01");
  });

  test("crosses month and year boundaries", () => {
    assert.equal(addDays("2026-08-31", 1), "2026-09-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  });

  test("handles leap day", () => {
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
    assert.equal(addDays("2024-02-29", 1), "2024-03-01");
    assert.equal(addDays("2025-02-28", 1), "2025-03-01");
  });
});

describe("eachDate", () => {
  test("is inclusive of both ends", () => {
    assert.deepEqual(eachDate("2026-08-01", "2026-08-03"), [
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  test("a single-day range yields one date", () => {
    assert.deepEqual(eachDate("2026-08-01", "2026-08-01"), ["2026-08-01"]);
  });

  test("spans a month boundary", () => {
    assert.deepEqual(eachDate("2026-07-30", "2026-08-02"), [
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  test("throws on an inverted range instead of returning empty", () => {
    // Returning [] would make a reversed range deduct zero days, so a leave
    // request with swapped dates would be approved and cost nothing.
    assert.throws(() => eachDate("2026-08-03", "2026-08-01"), /precedes start/);
  });
});

describe("calendarDaysBetween", () => {
  test("counts inclusively", () => {
    assert.equal(calendarDaysBetween("2026-08-01", "2026-08-01"), 1);
    assert.equal(calendarDaysBetween("2026-08-01", "2026-08-07"), 7);
  });

  test("crosses a year boundary", () => {
    assert.equal(calendarDaysBetween("2026-12-30", "2027-01-02"), 4);
  });

  test("throws on an inverted range", () => {
    assert.throws(() => calendarDaysBetween("2026-08-03", "2026-08-01"), /precedes start/);
  });
});

describe("leaveYearOf", () => {
  test("calendar basis is simply the calendar year", () => {
    assert.equal(leaveYearOf("2026-01-01", "calendar"), 2026);
    assert.equal(leaveYearOf("2026-12-31", "calendar"), 2026);
  });

  test("anniversary basis turns over on the employment start date", () => {
    const started = "2024-07-01";
    // Before the anniversary, they are still in the previous leave year.
    assert.equal(leaveYearOf("2026-06-30", "anniversary", started), 2025);
    // On and after it, the new one.
    assert.equal(leaveYearOf("2026-07-01", "anniversary", started), 2026);
    assert.equal(leaveYearOf("2027-06-30", "anniversary", started), 2026);
  });

  test("anniversary basis refuses to guess without a start date", () => {
    assert.throws(
      () => leaveYearOf("2026-06-30", "anniversary"),
      /requires employmentStartDate/
    );
  });
});
