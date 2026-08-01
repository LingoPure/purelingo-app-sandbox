/**
 * The day count.
 *
 * The single most consequential function in the module: it decides how many
 * days come off someone's balance. Everything else is bookkeeping around this
 * number, and if it is wrong the system silently miscounts people's leave.
 *
 * DELIBERATELY PURE. It takes the policy, the holiday list and the working-day
 * overrides as arguments rather than fetching them, so it can be exhaustively
 * unit-tested without a database. Loading those inputs is `policy.ts`'s job.
 *
 * ⚠️ PROVISIONAL. The rules it applies come from `hr_org_policy`, currently
 * populated with the recommended defaults from
 * docs/HR_MODULE_QUESTIONS_FOR_THAO.md — Monday-to-Friday, working days rather
 * than calendar days. When Thao confirms, the policy row changes and this
 * function's behaviour follows. No code change should be needed.
 */

import { eachDate, isoDayOfWeek, type DateOnly, type IsoDayOfWeek } from "./dates";
import type { HrHalfDay } from "./types";

/** Everything the count needs to know about the calendar. */
export type LeaveCalendar = {
  /** ISO day-of-week values that are normally worked. 1 = Mon … 7 = Sun. */
  workingDays: IsoDayOfWeek[];
  /** Public holidays, keyed by date. Value is the display name. */
  holidays: Map<DateOnly, string>;
  /**
   * Explicit per-date overrides of the working pattern.
   *
   * `true` is the Vietnamese `làm bù` case: a Saturday designated as worked to
   * bridge a holiday. `false` covers a company shutdown day that is not a
   * public holiday.
   */
  overrides: Map<DateOnly, boolean>;
};

export type DayVerdict = {
  date: DateOnly;
  /** How much of a leave day this date consumes: 0, 0.5 or 1. */
  charged: number;
  reason:
    | "worked"
    | "half-day"
    | "weekend"
    | "public-holiday"
    | "company-closure";
  /** Holiday name, when the reason is a public holiday. */
  label?: string;
};

export type LeaveDayCount = {
  /** Total charged against the balance. */
  days: number;
  /** Per-date detail, so the UI can explain the number rather than assert it. */
  breakdown: DayVerdict[];
};

/**
 * Is this date normally worked?
 *
 * Resolution order, and the order matters:
 *   1. the weekly pattern
 *   2. an explicit override for this date, which beats the pattern
 *   3. a public holiday, which beats both
 *
 * A holiday winning over an `is_working_day = true` override is a deliberate
 * choice about contradictory configuration. The two should never coexist on one
 * date — `làm bù` designates a DIFFERENT day as worked, not the holiday itself —
 * so if they do, it is operator error, and resolving it in the employee's
 * favour is the safer failure.
 */
export function isWorkingDay(date: DateOnly, calendar: LeaveCalendar): boolean {
  if (calendar.holidays.has(date)) return false;
  const override = calendar.overrides.get(date);
  if (override !== undefined) return override;
  return calendar.workingDays.includes(isoDayOfWeek(date));
}

function verdictFor(date: DateOnly, calendar: LeaveCalendar): DayVerdict {
  const holiday = calendar.holidays.get(date);
  if (holiday !== undefined) {
    return { date, charged: 0, reason: "public-holiday", label: holiday };
  }

  const override = calendar.overrides.get(date);
  if (override === false) {
    return { date, charged: 0, reason: "company-closure" };
  }
  if (override === true) {
    return { date, charged: 1, reason: "worked" };
  }

  return calendar.workingDays.includes(isoDayOfWeek(date))
    ? { date, charged: 1, reason: "worked" }
    : { date, charged: 0, reason: "weekend" };
}

export type CountLeaveDaysInput = {
  startDate: DateOnly;
  endDate: DateOnly;
  /** Which half of the FIRST day is taken, if it is a half day. */
  startHalf?: HrHalfDay | null;
  /** Which half of the LAST day is taken, if it is a half day. */
  endHalf?: HrHalfDay | null;
  calendar: LeaveCalendar;
};

/**
 * How many days this request costs.
 *
 * Weekends and public holidays are skipped structurally rather than as special
 * cases, which is what makes "Public Holidays must not deduct Annual or Sick
 * Leave" true by construction instead of by remembering to check.
 *
 * Half days apply only to the first and last date of a range. Half of a day in
 * the MIDDLE of a block is not a thing anyone takes, and supporting it would
 * mean storing a half-day flag per date for no real use.
 *
 * Single-date requests are handled separately because the general rule would
 * subtract twice when both halves are set. Setting both on one day is
 * contradictory input; it is read as a whole day, which is the only sensible
 * interpretation and avoids rejecting a form for a harmless mistake.
 */
export function countLeaveDays(input: CountLeaveDaysInput): LeaveDayCount {
  const { startDate, endDate, startHalf, endHalf, calendar } = input;

  // eachDate throws on an inverted range rather than returning nothing. Zero
  // days would mean a request with swapped dates is approved and costs the
  // employee nothing, which is exactly the kind of quiet wrongness this
  // function exists to prevent.
  const dates = eachDate(startDate, endDate);
  const breakdown = dates.map((date) => verdictFor(date, calendar));

  const singleDay = startDate === endDate;

  if (singleDay) {
    const only = breakdown[0];
    const halvesSet = (startHalf ? 1 : 0) + (endHalf ? 1 : 0);
    if (only.charged > 0 && halvesSet === 1) {
      breakdown[0] = { ...only, charged: 0.5, reason: "half-day" };
    }
  } else {
    const first = breakdown[0];
    if (startHalf && first.charged > 0) {
      breakdown[0] = { ...first, charged: 0.5, reason: "half-day" };
    }
    const lastIndex = breakdown.length - 1;
    const last = breakdown[lastIndex];
    if (endHalf && last.charged > 0) {
      breakdown[lastIndex] = { ...last, charged: 0.5, reason: "half-day" };
    }
  }

  const days = breakdown.reduce((total, day) => total + day.charged, 0);

  // Guard against float drift. Every charge is 0, 0.5 or 1, so the total is
  // always a multiple of 0.5 — but repeated addition of 0.5 can still produce
  // 2.0000000000000004, which would then be stored and displayed.
  return { days: Math.round(days * 2) / 2, breakdown };
}

/**
 * A one-line explanation of why the number is what it is.
 *
 * The requirement asks the submit form to show the requested days. Showing
 * "2 days" for a Friday-to-Monday request looks like a bug to anyone who has
 * not thought about it; showing why it is 2 pre-empts the question.
 */
export function explainCount(count: LeaveDayCount): string | null {
  const skipped = count.breakdown.filter((d) => d.charged === 0);
  if (skipped.length === 0) return null;

  const holidays = skipped.filter((d) => d.reason === "public-holiday");
  const weekends = skipped.filter((d) => d.reason === "weekend");
  const closures = skipped.filter((d) => d.reason === "company-closure");

  const parts: string[] = [];
  if (weekends.length > 0) {
    parts.push(`${weekends.length} non-working ${weekends.length === 1 ? "day" : "days"}`);
  }
  if (holidays.length > 0) {
    const names = [...new Set(holidays.map((h) => h.label).filter(Boolean))];
    parts.push(
      names.length > 0
        ? `${holidays.length} public holiday ${holidays.length === 1 ? "day" : "days"} (${names.join(", ")})`
        : `${holidays.length} public ${holidays.length === 1 ? "holiday" : "holidays"}`
    );
  }
  if (closures.length > 0) {
    parts.push(`${closures.length} company ${closures.length === 1 ? "closure" : "closures"}`);
  }

  if (parts.length === 0) return null;
  return `Not counted: ${parts.join(" and ")}.`;
}
