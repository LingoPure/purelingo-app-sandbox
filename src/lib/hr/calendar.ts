/**
 * The team calendar.
 *
 * Reads through `hr_team_availability` (0029), a SECURITY DEFINER projection
 * with no reason column in its return type — so leave reasons are structurally
 * unreachable here rather than filtered out by remembering to. The normal RLS
 * policy correctly limits a Staff member to their own requests, which would
 * leave them looking at an empty team calendar; this is the deliberate,
 * minimal, reason-free exception to that.
 *
 * Expansion from request ranges into per-day entries happens in TypeScript, not
 * SQL, so it uses the same `isWorkingDay` the day count uses. A second copy of
 * the working-day rules in SQL would drift from the one with 27 tests against
 * it, and the drift would show up as a calendar disagreeing with a balance.
 */

import { hrUserClient } from "./deps";
import { requireHrEmployee } from "./auth";
import { eachDate, type DateOnly } from "./dates";
import { isWorkingDay, type LeaveCalendar } from "./leave-days";
import { buildLeaveCalendar } from "./policy";
import type { HrHalfDay, HrRequestStatus } from "./types";

/** One person's absence on one date. Carries no reason, by construction. */
export type AvailabilityEntry = {
  requestId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string | null;
  leaveTypeId: string;
  leaveTypeCode: string;
  status: HrRequestStatus;
  /** True when only part of this day is taken. */
  isHalfDay: boolean;
  half: HrHalfDay | null;
};

export type CalendarDay = {
  date: DateOnly;
  isWorkingDay: boolean;
  /** Set when the date is a public holiday. */
  holidayName: string | null;
  away: AvailabilityEntry[];
};

type AvailabilityRow = {
  request_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  leave_type_id: string;
  leave_type_code: string;
  start_date: string;
  end_date: string;
  start_half: HrHalfDay | null;
  end_half: HrHalfDay | null;
  status: HrRequestStatus;
};

/**
 * Every day in the range, with who is away on each.
 *
 * Non-working days are returned too, flagged rather than dropped — a calendar
 * that silently omits weekends is disorienting, and a public holiday is
 * something people specifically come here to look for.
 *
 * A leave range is NOT expanded across non-working days. Someone on leave from
 * Friday to Monday is not "away" on the Saturday in any sense the team cares
 * about; showing them as absent all weekend is noise that makes the genuinely
 * useful signal harder to read.
 */
export async function getTeamCalendar(
  from: DateOnly,
  to: DateOnly
): Promise<CalendarDay[]> {
  const me = await requireHrEmployee();
  const supabase = await hrUserClient();

  const [{ data, error }, calendar] = await Promise.all([
    supabase.rpc("hr_team_availability", { p_from: from, p_to: to }),
    buildLeaveCalendar(me.orgId, from, to),
  ]);

  if (error) {
    console.error("[hr/calendar] availability read failed:", error.message);
  }

  const rows = (data ?? []) as unknown as AvailabilityRow[];
  const byDate = new Map<DateOnly, AvailabilityEntry[]>();

  for (const row of rows) {
    // Clamp to the window: a request may start before `from` or end after `to`.
    const rangeStart = row.start_date > from ? (row.start_date as DateOnly) : from;
    const rangeEnd = row.end_date < to ? (row.end_date as DateOnly) : to;
    if (rangeEnd < rangeStart) continue;

    for (const date of eachDate(rangeStart, rangeEnd)) {
      if (!isWorkingDay(date, calendar)) continue;

      const half = halfFor(date, row);
      const entry: AvailabilityEntry = {
        requestId: row.request_id,
        employeeId: row.employee_id,
        firstName: row.first_name,
        lastName: row.last_name,
        department: row.department,
        leaveTypeId: row.leave_type_id,
        leaveTypeCode: row.leave_type_code,
        status: row.status,
        isHalfDay: half !== null,
        half,
      };

      const existing = byDate.get(date);
      if (existing) existing.push(entry);
      else byDate.set(date, [entry]);
    }
  }

  return eachDate(from, to).map((date) => ({
    date,
    isWorkingDay: isWorkingDay(date, calendar),
    holidayName: calendar.holidays.get(date) ?? null,
    away: (byDate.get(date) ?? []).sort((a, b) =>
      a.firstName.localeCompare(b.firstName)
    ),
  }));
}

/**
 * Which half of this date is taken, if any.
 *
 * Half days only apply at the ends of a range, matching `countLeaveDays`. On a
 * single-date request with both halves set — contradictory input, read there as
 * a whole day — this returns null so the calendar agrees with the deduction.
 */
function halfFor(date: DateOnly, row: AvailabilityRow): HrHalfDay | null {
  const singleDay = row.start_date === row.end_date;
  if (singleDay) {
    const halvesSet = (row.start_half ? 1 : 0) + (row.end_half ? 1 : 0);
    return halvesSet === 1 ? (row.start_half ?? row.end_half) : null;
  }
  if (date === row.start_date) return row.start_half;
  if (date === row.end_date) return row.end_half;
  return null;
}

/** The month containing `anchor`, as a first/last date pair. */
export function monthBounds(anchor: DateOnly): { from: DateOnly; to: DateOnly } {
  const [year, month] = anchor.split("-").map(Number);
  const first = `${anchor.slice(0, 7)}-01`;
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: first,
    to: `${anchor.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Shift a `YYYY-MM` anchor by whole months, for calendar navigation. */
export function shiftMonth(anchor: DateOnly, months: number): DateOnly {
  const [year, month] = anchor.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return shifted.toISOString().slice(0, 10);
}

export type { LeaveCalendar };
