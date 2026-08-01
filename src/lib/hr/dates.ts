/**
 * Timezone-safe date handling for the HR module.
 *
 * THE PROBLEM THIS FILE EXISTS TO SOLVE. Vercel runs in UTC. LingoPure's staff
 * are in Vietnam (UTC+7). For seven hours of every day, "today" in UTC is
 * yesterday in Ho Chi Minh City. Any leave system that asks JavaScript what day
 * it is will, during those seven hours, show the wrong "who is off today",
 * stamp the wrong effective date on a balance adjustment, and count a leave
 * request that starts tomorrow as starting today.
 *
 * THE RULES, which the rest of the module must follow:
 *
 *   1. A calendar date is a STRING, `YYYY-MM-DD`. Not a `Date`. A `Date` is an
 *      instant in time and carries a timezone; "the 3rd of March" does not.
 *   2. Never call `new Date()` in module logic. Call `todayInTimeZone()`.
 *   3. Never call `.getDay()`, `.getMonth()`, `.getDate()` on a parsed date.
 *      Those read the SERVER's timezone. Use the helpers here, which operate in
 *      UTC internally so they cannot drift.
 *
 * Vietnam has observed no daylight saving since 1975, so ICT is a flat UTC+7.
 * These helpers still resolve the offset through `Intl` rather than hardcoding
 * it, because the module is org-scoped and a future org may not be in Vietnam.
 */

/** A calendar date with no time and no timezone: `YYYY-MM-DD`. */
export type DateOnly = string;

/** ISO day of week: 1 = Monday … 7 = Sunday. Matches `hr_org_policy.working_days`. */
export type IsoDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** True when the string is a well-formed `YYYY-MM-DD` naming a real calendar day. */
export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  // Rejects 2026-02-30: round-tripping through UTC normalises an overflowing
  // day, so a mismatch means the input named a date that does not exist.
  const [y, m, d] = value.split("-").map(Number);
  const asUtc = new Date(Date.UTC(y, m - 1, d));
  return (
    asUtc.getUTCFullYear() === y &&
    asUtc.getUTCMonth() === m - 1 &&
    asUtc.getUTCDate() === d
  );
}

function assertDateOnly(value: string, label: string): void {
  if (!isDateOnly(value)) {
    throw new Error(`hr/dates: ${label} must be YYYY-MM-DD, received "${value}"`);
  }
}

/**
 * The current calendar date in the given timezone.
 *
 * This is the ONLY sanctioned way for the module to ask what day it is.
 * `en-CA` is used because its short date format is exactly `YYYY-MM-DD`.
 */
export function todayInTimeZone(timeZone: string, now?: Date): DateOnly {
  const instant = now ?? new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * ISO day of week for a calendar date.
 *
 * Computed in UTC deliberately. A date-only string has no timezone, so its day
 * of week is the same everywhere on earth — but `new Date("2026-08-01").getDay()`
 * would consult the server's zone and can answer for the previous day.
 */
export function isoDayOfWeek(date: DateOnly): IsoDayOfWeek {
  assertDateOnly(date, "date");
  const [y, m, d] = date.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (jsDay === 0 ? 7 : jsDay) as IsoDayOfWeek;
}

/** Calendar date `days` after (or, when negative, before) the given date. */
export function addDays(date: DateOnly, days: number): DateOnly {
  assertDateOnly(date, "date");
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Every calendar date from `start` to `end`, inclusive.
 *
 * Throws when the range is inverted rather than returning an empty array: a
 * reversed range is a caller bug, and silently counting it as zero days would
 * approve leave that deducts nothing.
 */
export function eachDate(start: DateOnly, end: DateOnly): DateOnly[] {
  assertDateOnly(start, "start");
  assertDateOnly(end, "end");
  if (end < start) {
    throw new Error(`hr/dates: end (${end}) precedes start (${start})`);
  }
  const out: DateOnly[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    out.push(cursor);
  }
  return out;
}

/** Inclusive count of calendar days in a range. Not a leave-day count. */
export function calendarDaysBetween(start: DateOnly, end: DateOnly): number {
  assertDateOnly(start, "start");
  assertDateOnly(end, "end");
  if (end < start) {
    throw new Error(`hr/dates: end (${end}) precedes start (${start})`);
  }
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** Calendar year of a date. The leave year under a `calendar` policy basis. */
export function yearOf(date: DateOnly): number {
  assertDateOnly(date, "date");
  return Number(date.slice(0, 4));
}

/**
 * The leave year a date falls in.
 *
 * Under `calendar` basis this is simply the calendar year. Under `anniversary`
 * basis the year turns over on the employee's start date, so someone who joined
 * on 1 July 2024 is in leave year 2026 from 1 July 2026 until 30 June 2027.
 */
export function leaveYearOf(
  date: DateOnly,
  basis: "calendar" | "anniversary",
  employmentStartDate?: DateOnly
): number {
  assertDateOnly(date, "date");
  if (basis === "calendar") return yearOf(date);
  if (!employmentStartDate) {
    throw new Error(
      "hr/dates: anniversary leave-year basis requires employmentStartDate"
    );
  }
  assertDateOnly(employmentStartDate, "employmentStartDate");
  const anniversaryThisYear = `${date.slice(0, 4)}-${employmentStartDate.slice(5)}`;
  return date >= anniversaryThisYear ? yearOf(date) : yearOf(date) - 1;
}
