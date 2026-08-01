/**
 * Tests for src/lib/hr/leave-days.ts — the day count.
 *
 * This is the function that decides how many days come off someone's balance,
 * so it gets the heaviest coverage in the module. Every case below maps to
 * something a real request will hit in a Vietnamese working year.
 *
 * Run: npm run test:hr
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  countLeaveDays,
  isWorkingDay,
  explainCount,
  type LeaveCalendar,
} from "../../src/lib/hr/leave-days";

/**
 * The provisional default: Monday to Friday.
 * ⚠️ Not yet confirmed by the client — if LingoPure works Saturday mornings,
 * the policy row changes and these expectations change with it. The function
 * reads the pattern from policy, so no code changes.
 */
function calendar(overrides?: Partial<LeaveCalendar>): LeaveCalendar {
  return {
    workingDays: [1, 2, 3, 4, 5],
    holidays: new Map(),
    overrides: new Map(),
    ...overrides,
  };
}

// Anchor dates. 2026-08-03 is a Monday, 2026-08-08 a Saturday, 09 a Sunday.
const MON = "2026-08-03";
const TUE = "2026-08-04";
const WED = "2026-08-05";
const THU = "2026-08-06";
const FRI = "2026-08-07";
const SAT = "2026-08-08";
const SUN = "2026-08-09";
const NEXT_MON = "2026-08-10";
const NEXT_TUE = "2026-08-11";

describe("isWorkingDay", () => {
  test("weekdays are worked, weekends are not", () => {
    const c = calendar();
    assert.equal(isWorkingDay(MON, c), true);
    assert.equal(isWorkingDay(FRI, c), true);
    assert.equal(isWorkingDay(SAT, c), false);
    assert.equal(isWorkingDay(SUN, c), false);
  });

  test("a public holiday is not worked, even on a weekday", () => {
    const c = calendar({ holidays: new Map([[WED, "National Day"]]) });
    assert.equal(isWorkingDay(WED, c), false);
  });

  test("a lam bu override makes a Saturday a working day", () => {
    const c = calendar({ overrides: new Map([[SAT, true]]) });
    assert.equal(isWorkingDay(SAT, c), true);
  });

  test("a closure override makes a weekday non-working", () => {
    const c = calendar({ overrides: new Map([[WED, false]]) });
    assert.equal(isWorkingDay(WED, c), false);
  });

  test("a holiday beats a working-day override on the same date", () => {
    // Contradictory configuration — lam bu designates a DIFFERENT day as
    // worked, never the holiday itself. Resolved in the employee's favour.
    const c = calendar({
      holidays: new Map([[SAT, "Shifted holiday"]]),
      overrides: new Map([[SAT, true]]),
    });
    assert.equal(isWorkingDay(SAT, c), false);
  });
});

describe("countLeaveDays — the cases the requirement names", () => {
  test("Friday to Monday over a normal weekend costs 2 days", () => {
    // The headline case. Four calendar days, two working days. Anyone who has
    // not thought about it expects 4, which is why the UI explains the number.
    const result = countLeaveDays({
      startDate: FRI,
      endDate: NEXT_MON,
      calendar: calendar(),
    });
    assert.equal(result.days, 2);
    assert.equal(result.breakdown.length, 4);
  });

  test("a full working week costs 5 days", () => {
    assert.equal(
      countLeaveDays({ startDate: MON, endDate: FRI, calendar: calendar() }).days,
      5
    );
  });

  test("a week containing one public holiday costs 4 days", () => {
    const c = calendar({ holidays: new Map([[WED, "National Day"]]) });
    const result = countLeaveDays({ startDate: MON, endDate: FRI, calendar: c });
    assert.equal(result.days, 4);
    const wed = result.breakdown.find((d) => d.date === WED);
    assert.equal(wed?.reason, "public-holiday");
    assert.equal(wed?.label, "National Day");
  });

  test("a week containing a lam bu Saturday costs 6 days", () => {
    // Monday to Saturday, where the Saturday has been designated as worked to
    // bridge a holiday elsewhere.
    const c = calendar({ overrides: new Map([[SAT, true]]) });
    assert.equal(
      countLeaveDays({ startDate: MON, endDate: SAT, calendar: c }).days,
      6
    );
  });

  test("a half day costs exactly 0.5", () => {
    assert.equal(
      countLeaveDays({
        startDate: WED,
        endDate: WED,
        startHalf: "pm",
        calendar: calendar(),
      }).days,
      0.5
    );
  });

  test("a single day with BOTH halves set costs a whole day, not zero", () => {
    // Contradictory input. Read as a whole day rather than rejected, so a
    // harmless form mistake does not block a submission. The naive
    // implementation subtracts 0.5 twice and charges 0.
    assert.equal(
      countLeaveDays({
        startDate: WED,
        endDate: WED,
        startHalf: "am",
        endHalf: "pm",
        calendar: calendar(),
      }).days,
      1
    );
  });

  test("half days at both ends of a multi-day range cost 0.5 each", () => {
    // Wednesday afternoon through Friday morning = 0.5 + 1 + 0.5.
    assert.equal(
      countLeaveDays({
        startDate: WED,
        endDate: FRI,
        startHalf: "pm",
        endHalf: "am",
        calendar: calendar(),
      }).days,
      2
    );
  });

  test("Unpaid and Public Holiday types are handled by the caller, not here", () => {
    // The count is type-agnostic on purpose: whether a type DEDUCTS is a
    // property of hr_leave_types.deducts_balance, checked when the ledger row
    // is written. Duplicating that rule here would create a second place for it
    // to disagree with itself.
    const result = countLeaveDays({ startDate: MON, endDate: TUE, calendar: calendar() });
    assert.equal(result.days, 2);
  });
});

describe("countLeaveDays — edge cases", () => {
  test("a single working day costs 1", () => {
    assert.equal(
      countLeaveDays({ startDate: MON, endDate: MON, calendar: calendar() }).days,
      1
    );
  });

  test("a single non-working day costs 0", () => {
    assert.equal(
      countLeaveDays({ startDate: SAT, endDate: SAT, calendar: calendar() }).days,
      0
    );
  });

  test("a half day flag on a non-working day still costs 0", () => {
    // Nothing to halve. Charging 0.5 for a Saturday would take half a day of
    // annual leave for a day nobody was due to work.
    assert.equal(
      countLeaveDays({
        startDate: SAT,
        endDate: SAT,
        startHalf: "am",
        calendar: calendar(),
      }).days,
      0
    );
  });

  test("a range entirely inside a weekend costs 0", () => {
    assert.equal(
      countLeaveDays({ startDate: SAT, endDate: SUN, calendar: calendar() }).days,
      0
    );
  });

  test("a start-half on a weekend does not shift the deduction elsewhere", () => {
    // Saturday to the following Tuesday with a half on the Saturday: the
    // Saturday is not worked, so the half applies to nothing and Mon+Tue stay
    // whole. A naive implementation that subtracts 0.5 from the total rather
    // than from the first day would answer 1.5 here.
    assert.equal(
      countLeaveDays({
        startDate: SAT,
        endDate: NEXT_TUE,
        startHalf: "pm",
        calendar: calendar(),
      }).days,
      2
    );
  });

  test("a multi-day Tet holiday is excluded across all its dates", () => {
    const c = calendar({
      holidays: new Map([
        [TUE, "Tết Nguyên Đán"],
        [WED, "Tết Nguyên Đán"],
        [THU, "Tết Nguyên Đán"],
      ]),
    });
    assert.equal(
      countLeaveDays({ startDate: MON, endDate: FRI, calendar: c }).days,
      2
    );
  });

  test("an inverted range throws rather than costing zero days", () => {
    assert.throws(
      () => countLeaveDays({ startDate: FRI, endDate: MON, calendar: calendar() }),
      /precedes start/
    );
  });

  test("a long range stays exact — no floating point drift", () => {
    // Repeatedly adding 0.5 can yield 2.0000000000000004, which would then be
    // written to the ledger and rendered to a user.
    const result = countLeaveDays({
      startDate: "2026-08-03",
      endDate: "2026-10-30",
      startHalf: "pm",
      endHalf: "am",
      calendar: calendar(),
    });
    assert.equal(result.days * 2, Math.round(result.days * 2));
    assert.equal(Number.isInteger(result.days * 2), true);
  });

  test("a six-day working week counts Saturdays", () => {
    // ⚠️ The open client question A1. If LingoPure works Saturdays, this is
    // what changes — a policy row, not this function.
    const c = calendar({ workingDays: [1, 2, 3, 4, 5, 6] });
    assert.equal(countLeaveDays({ startDate: MON, endDate: SAT, calendar: c }).days, 6);
    assert.equal(countLeaveDays({ startDate: SAT, endDate: SAT, calendar: c }).days, 1);
  });

  test("a company closure day is excluded", () => {
    const c = calendar({ overrides: new Map([[WED, false]]) });
    const result = countLeaveDays({ startDate: MON, endDate: FRI, calendar: c });
    assert.equal(result.days, 4);
    assert.equal(result.breakdown.find((d) => d.date === WED)?.reason, "company-closure");
  });
});

describe("explainCount", () => {
  test("says nothing when every day was charged", () => {
    const result = countLeaveDays({ startDate: MON, endDate: TUE, calendar: calendar() });
    assert.equal(explainCount(result), null);
  });

  test("names the weekend", () => {
    const result = countLeaveDays({ startDate: FRI, endDate: NEXT_MON, calendar: calendar() });
    assert.match(explainCount(result) ?? "", /2 non-working days/);
  });

  test("names the holiday", () => {
    const c = calendar({ holidays: new Map([[WED, "National Day"]]) });
    const result = countLeaveDays({ startDate: MON, endDate: FRI, calendar: c });
    const text = explainCount(result) ?? "";
    assert.match(text, /National Day/);
  });

  test("names a multi-day holiday once, not once per date", () => {
    const c = calendar({
      holidays: new Map([
        [TUE, "Tết Nguyên Đán"],
        [WED, "Tết Nguyên Đán"],
      ]),
    });
    const result = countLeaveDays({ startDate: MON, endDate: FRI, calendar: c });
    const text = explainCount(result) ?? "";
    assert.equal(text.match(/Tết Nguyên Đán/g)?.length, 1);
  });
});
