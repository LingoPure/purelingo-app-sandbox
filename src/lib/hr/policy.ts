/**
 * Loading the leave rules and the calendar they apply to.
 *
 * `leave-days.ts` is pure so it can be tested exhaustively; this file is the
 * impure half that fetches what that function needs.
 *
 * ⚠️ EVERY POLICY VALUE IS PROVISIONAL. `hr_org_policy` currently holds the
 * recommended defaults from docs/HR_MODULE_QUESTIONS_FOR_THAO.md, not confirmed
 * client answers. When Thao replies, the row is updated and behaviour follows —
 * that indirection is the whole reason these are rows rather than constants.
 */

import { hrUserClient, hrServiceClient } from "./deps";
import type { DateOnly, IsoDayOfWeek } from "./dates";
import type { LeaveCalendar } from "./leave-days";
import type { HrOrgPolicy, HrLeaveType, HrPublicHoliday } from "./types";

type PolicyRow = {
  org_id: string;
  working_days: number[];
  saturday_hours: "none" | "half" | "full";
  count_basis: "working_days" | "calendar_days";
  day_start_time: string;
  day_end_time: string;
  accrual_mode: "monthly" | "annual_grant";
  leave_year_basis: "calendar" | "anniversary";
  carry_over_max_days: number;
  carry_over_expiry_month: number | null;
  prorate_first_year: boolean;
  over_balance_policy: "block" | "allow_negative" | "spill_to_unpaid";
  min_notice_days: number;
  approver_escalation: "super_admin" | "peer_super_admin" | "self_approve_logged";
  self_cancel_future: boolean;
  self_cancel_past: boolean;
  holiday_notice_days: number;
  default_locale: "en" | "vi";
};

/**
 * The defaults used if the policy row is somehow missing.
 *
 * Not a convenience. A missing policy row must not mean "no rules" — that would
 * silently count weekends as leave and charge people for days they never
 * worked. Mirrors the migration's seeded values exactly.
 */
const FALLBACK_POLICY: Omit<HrOrgPolicy, "orgId"> = {
  workingDays: [1, 2, 3, 4, 5],
  saturdayHours: "none",
  countBasis: "working_days",
  dayStartTime: "08:30",
  dayEndTime: "17:30",
  accrualMode: "monthly",
  leaveYearBasis: "calendar",
  carryOverMaxDays: 5,
  carryOverExpiryMonth: 3,
  prorateFirstYear: true,
  overBalancePolicy: "block",
  minNoticeDays: 0,
  approverEscalation: "super_admin",
  selfCancelFuture: true,
  selfCancelPast: false,
  holidayNoticeDays: 7,
  defaultLocale: "vi",
};

function toPolicy(row: PolicyRow): HrOrgPolicy {
  return {
    orgId: row.org_id,
    workingDays: (row.working_days ?? [1, 2, 3, 4, 5]) as IsoDayOfWeek[],
    saturdayHours: row.saturday_hours,
    countBasis: row.count_basis,
    dayStartTime: row.day_start_time,
    dayEndTime: row.day_end_time,
    accrualMode: row.accrual_mode,
    leaveYearBasis: row.leave_year_basis,
    carryOverMaxDays: Number(row.carry_over_max_days),
    carryOverExpiryMonth: row.carry_over_expiry_month,
    prorateFirstYear: row.prorate_first_year,
    overBalancePolicy: row.over_balance_policy,
    minNoticeDays: row.min_notice_days,
    approverEscalation: row.approver_escalation,
    selfCancelFuture: row.self_cancel_future,
    selfCancelPast: row.self_cancel_past,
    holidayNoticeDays: row.holiday_notice_days,
    defaultLocale: row.default_locale,
  };
}

export async function getOrgPolicy(orgId: string): Promise<HrOrgPolicy> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_org_policy")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[hr/policy] load failed:", error.message);
    return { orgId, ...FALLBACK_POLICY };
  }
  return toPolicy(data as unknown as PolicyRow);
}

export async function getOrgTimezone(orgId: string): Promise<string> {
  const supabase = await hrUserClient();
  const { data } = await supabase
    .from("hr_organisations")
    .select("timezone")
    .eq("id", orgId)
    .maybeSingle();
  return (data as unknown as { timezone: string } | null)?.timezone ?? "Asia/Ho_Chi_Minh";
}

export async function listLeaveTypes(orgId: string): Promise<HrLeaveType[]> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_leave_types")
    .select("*")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("sort_order");

  if (error) {
    console.error("[hr/policy] leave types failed:", error.message);
    return [];
  }

  return (data as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    code: row.code as string,
    nameEn: row.name_en as string,
    nameVi: row.name_vi as string,
    deductsBalance: row.deducts_balance as boolean,
    defaultAllowance: row.default_allowance as number | null,
    requiresApproval: row.requires_approval as boolean,
    active: row.active as boolean,
    sortOrder: row.sort_order as number,
  }));
}

export async function listHolidays(
  orgId: string,
  from: DateOnly,
  to: DateOnly
): Promise<HrPublicHoliday[]> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_public_holidays")
    .select("*")
    .eq("org_id", orgId)
    .gte("date", from)
    .lte("date", to)
    .order("date");

  if (error) {
    console.error("[hr/policy] holidays failed:", error.message);
    return [];
  }

  return (data as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    date: row.date as DateOnly,
    nameEn: row.name_en as string,
    nameVi: row.name_vi as string,
    isRecurring: row.is_recurring as boolean,
    notifiedAt: row.notified_at as string | null,
  }));
}

/**
 * Build the calendar the day count needs, for one date range.
 *
 * Scoped to the range rather than loading every holiday ever recorded: a leave
 * request spans days, not decades, and the query runs on every keystroke in the
 * submit form's live day count.
 *
 * ⚠️ On a query failure this returns an EMPTY holiday set rather than throwing,
 * which means a request spanning a holiday would over-count. That is the safer
 * direction (the employee is charged more, and a human reviews it at approval)
 * but it is still wrong, so the failure is logged loudly. Degrading to "no
 * weekends either" would be far worse.
 */
export async function buildLeaveCalendar(
  orgId: string,
  from: DateOnly,
  to: DateOnly,
  policy?: HrOrgPolicy
): Promise<LeaveCalendar> {
  const resolvedPolicy = policy ?? (await getOrgPolicy(orgId));
  const supabase = await hrUserClient();

  const [holidayResult, overrideResult] = await Promise.all([
    supabase
      .from("hr_public_holidays")
      .select("date, name_en, name_vi")
      .eq("org_id", orgId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("hr_working_day_overrides")
      .select("date, is_working_day")
      .eq("org_id", orgId)
      .gte("date", from)
      .lte("date", to),
  ]);

  if (holidayResult.error) {
    console.error(
      "[hr/policy] holiday lookup failed — the day count will over-charge:",
      holidayResult.error.message
    );
  }
  if (overrideResult.error) {
    console.error(
      "[hr/policy] working-day override lookup failed:",
      overrideResult.error.message
    );
  }

  const holidays = new Map<DateOnly, string>();
  for (const row of (holidayResult.data ?? []) as unknown as Array<{
    date: DateOnly;
    name_en: string;
    name_vi: string;
  }>) {
    // English name here; the UI re-labels per viewer locale. Storing the
    // localised string in the calendar would bake one language into a value
    // that gets rendered to speakers of the other.
    holidays.set(row.date, row.name_en);
  }

  const overrides = new Map<DateOnly, boolean>();
  for (const row of (overrideResult.data ?? []) as unknown as Array<{
    date: DateOnly;
    is_working_day: boolean;
  }>) {
    overrides.set(row.date, row.is_working_day);
  }

  return { workingDays: resolvedPolicy.workingDays, holidays, overrides };
}

/**
 * Service-role variant, for paths with no user session — the holiday reminder
 * cron in #7, and anything running before a request is bound to a caller.
 */
export async function buildLeaveCalendarAsService(
  orgId: string,
  from: DateOnly,
  to: DateOnly
): Promise<LeaveCalendar> {
  const service = hrServiceClient();
  const [{ data: policyRow }, { data: holidayRows }, { data: overrideRows }] =
    await Promise.all([
      service.from("hr_org_policy").select("working_days").eq("org_id", orgId).maybeSingle(),
      service
        .from("hr_public_holidays")
        .select("date, name_en")
        .eq("org_id", orgId)
        .gte("date", from)
        .lte("date", to),
      service
        .from("hr_working_day_overrides")
        .select("date, is_working_day")
        .eq("org_id", orgId)
        .gte("date", from)
        .lte("date", to),
    ]);

  const workingDays =
    ((policyRow as unknown as { working_days: number[] } | null)?.working_days as
      | IsoDayOfWeek[]
      | undefined) ?? FALLBACK_POLICY.workingDays;

  const holidays = new Map<DateOnly, string>();
  for (const row of (holidayRows ?? []) as unknown as Array<{ date: DateOnly; name_en: string }>) {
    holidays.set(row.date, row.name_en);
  }
  const overrides = new Map<DateOnly, boolean>();
  for (const row of (overrideRows ?? []) as unknown as Array<{
    date: DateOnly;
    is_working_day: boolean;
  }>) {
    overrides.set(row.date, row.is_working_day);
  }

  return { workingDays, holidays, overrides };
}
