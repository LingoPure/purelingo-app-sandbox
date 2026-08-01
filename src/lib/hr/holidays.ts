/**
 * Public holidays and working-day overrides.
 *
 * TWO TABLES, NOT ONE, and the reason is specific to Vietnam. When a public
 * holiday falls near a weekend, Vietnamese employers routinely shift the day
 * off to a weekday AND designate a Saturday as worked to bridge it — `làm bù`.
 * A holidays-only table can say "this day is off"; it cannot say "this Saturday
 * IS a working day". Without the second statement every day count in that week
 * is wrong, and wrong in the direction that costs employees leave.
 *
 * Multi-day holidays (Tết runs five days) are stored as one row per DATE rather
 * than as a range. "Is date D a holiday?" is the hot query — it runs for every
 * date of every leave request — and a range would turn a key lookup into a scan.
 * Contiguous dates sharing a name are grouped for display only.
 */

import { hrUserClient, hrServiceClient } from "./deps";
import { requireHrSuperAdmin, requireHrEmployee } from "./auth";
import { writeAudit } from "./employees";
import { addDays, isDateOnly, type DateOnly } from "./dates";
import type { HrPublicHoliday, HrWorkingDayOverride } from "./types";

type HolidayRow = {
  id: string;
  org_id: string;
  date: string;
  name_en: string;
  name_vi: string;
  is_recurring: boolean;
  notified_at: string | null;
};

function toHoliday(row: HolidayRow): HrPublicHoliday {
  return {
    id: row.id,
    orgId: row.org_id,
    date: row.date as DateOnly,
    nameEn: row.name_en,
    nameVi: row.name_vi,
    isRecurring: row.is_recurring,
    notifiedAt: row.notified_at,
  };
}

/** A run of consecutive dates sharing a name — how Tết is shown to a human. */
export type HolidayGroup = {
  nameEn: string;
  nameVi: string;
  startDate: DateOnly;
  endDate: DateOnly;
  dates: HrPublicHoliday[];
  isRecurring: boolean;
};

export async function listHolidaysInYear(
  orgId: string,
  year: number
): Promise<HrPublicHoliday[]> {
  await requireHrEmployee();
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_public_holidays")
    .select("*")
    .eq("org_id", orgId)
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");

  if (error) {
    console.error("[hr/holidays] list failed:", error.message);
    return [];
  }
  return (data as unknown as HolidayRow[]).map(toHoliday);
}

/**
 * Collapse consecutive same-name dates into one entry.
 *
 * Five separate "Tết Nguyên Đán" rows in a list is noise; "Tết Nguyên Đán,
 * 16-20 February" is the thing a person is looking for. Grouping is presentation
 * only — the storage stays one row per date.
 */
export function groupHolidays(holidays: HrPublicHoliday[]): HolidayGroup[] {
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const groups: HolidayGroup[] = [];

  for (const holiday of sorted) {
    const last = groups[groups.length - 1];
    const isContinuation =
      last &&
      last.nameEn === holiday.nameEn &&
      addDays(last.endDate, 1) === holiday.date;

    if (isContinuation) {
      last.endDate = holiday.date;
      last.dates.push(holiday);
    } else {
      groups.push({
        nameEn: holiday.nameEn,
        nameVi: holiday.nameVi,
        startDate: holiday.date,
        endDate: holiday.date,
        dates: [holiday],
        isRecurring: holiday.isRecurring,
      });
    }
  }
  return groups;
}

export type CreateHolidayInput = {
  startDate: DateOnly;
  /** Omit for a single-day holiday. */
  endDate?: DateOnly | null;
  nameEn: string;
  nameVi: string;
  isRecurring?: boolean;
};

/**
 * Add a holiday, expanding a range into one row per date.
 *
 * Existing dates are left alone rather than overwritten, so re-adding an
 * overlapping range is a no-op instead of a silent rename of somebody else's
 * entry.
 */
export async function createHoliday(
  input: CreateHolidayInput
): Promise<{ created: number; skipped: number }> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  if (!isDateOnly(input.startDate)) {
    throw new Error("Start date must be a real date.");
  }
  const endDate = input.endDate && isDateOnly(input.endDate) ? input.endDate : input.startDate;
  if (endDate < input.startDate) {
    throw new Error("The end date is before the start date.");
  }

  const dates: DateOnly[] = [];
  for (let cursor = input.startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
    // Tết is five days; a hundred is a typo, not a holiday.
    if (dates.length > 60) throw new Error("That range is longer than 60 days.");
  }

  const { data, error } = await service
    .from("hr_public_holidays")
    .upsert(
      dates.map((date) => ({
        org_id: actor.orgId,
        date,
        name_en: input.nameEn.trim(),
        name_vi: input.nameVi.trim() || input.nameEn.trim(),
        is_recurring: input.isRecurring ?? false,
      })),
      { onConflict: "org_id,date", ignoreDuplicates: true }
    )
    .select("id");

  if (error) throw new Error(`[hr/holidays] create failed: ${error.message}`);

  const created = (data ?? []).length;
  await writeAudit(actor.employeeId, actor.orgId, "holiday.created", "hr_public_holidays",
    null, null, { name: input.nameEn, from: input.startDate, to: endDate, created });

  return { created, skipped: dates.length - created };
}

/** Remove a holiday, by every date in its group. */
export async function deleteHolidayGroup(
  nameEn: string,
  startDate: DateOnly,
  endDate: DateOnly
): Promise<number> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  const { data, error } = await service
    .from("hr_public_holidays")
    .delete()
    .eq("org_id", actor.orgId)
    .eq("name_en", nameEn)
    .gte("date", startDate)
    .lte("date", endDate)
    .select("id");

  if (error) throw new Error(`[hr/holidays] delete failed: ${error.message}`);

  const removed = (data ?? []).length;
  await writeAudit(actor.employeeId, actor.orgId, "holiday.deleted", "hr_public_holidays",
    null, { name: nameEn, from: startDate, to: endDate }, { removed });

  return removed;
}

// ── Working-day overrides (làm bù) ───────────────────────────────────────────

type OverrideRow = {
  id: string;
  org_id: string;
  date: string;
  is_working_day: boolean;
  note: string | null;
};

export async function listOverridesInYear(
  orgId: string,
  year: number
): Promise<HrWorkingDayOverride[]> {
  await requireHrEmployee();
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_working_day_overrides")
    .select("*")
    .eq("org_id", orgId)
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");

  if (error) {
    console.error("[hr/holidays] overrides list failed:", error.message);
    return [];
  }
  return (data as unknown as OverrideRow[]).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    date: row.date as DateOnly,
    isWorkingDay: row.is_working_day,
    note: row.note,
  }));
}

/**
 * Mark a date as worked or not worked, overriding the weekly pattern.
 *
 * `isWorkingDay: true` is the `làm bù` case — a Saturday worked to bridge a
 * holiday. `false` covers a company shutdown that is not a public holiday.
 *
 * Setting an override on a date that is ALSO a public holiday is rejected
 * rather than accepted-and-ignored. The day count resolves that contradiction
 * by letting the holiday win, so accepting it would leave a Super Admin looking
 * at a setting that does nothing, with no indication why.
 */
export async function setWorkingDayOverride(
  date: DateOnly,
  isWorkingDay: boolean,
  note?: string | null
): Promise<void> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  if (!isDateOnly(date)) throw new Error("That is not a real date.");

  if (isWorkingDay) {
    const { data: clash } = await service
      .from("hr_public_holidays")
      .select("name_en")
      .eq("org_id", actor.orgId)
      .eq("date", date)
      .maybeSingle();
    if (clash) {
      const name = (clash as { name_en: string }).name_en;
      throw new Error(
        `${date} is already a public holiday (${name}), so it cannot also be a ` +
          `working day. Compensatory days bridge a holiday by designating a ` +
          `different date as worked — remove the holiday first if that is what you meant.`
      );
    }
  }

  const { error } = await service.from("hr_working_day_overrides").upsert(
    {
      org_id: actor.orgId,
      date,
      is_working_day: isWorkingDay,
      note: note?.trim() || null,
    },
    { onConflict: "org_id,date" }
  );

  if (error) throw new Error(`[hr/holidays] override failed: ${error.message}`);

  await writeAudit(actor.employeeId, actor.orgId, "working_day_override.set",
    "hr_working_day_overrides", null, null, { date, is_working_day: isWorkingDay });
}

export async function removeWorkingDayOverride(date: DateOnly): Promise<void> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  const { error } = await service
    .from("hr_working_day_overrides")
    .delete()
    .eq("org_id", actor.orgId)
    .eq("date", date);

  if (error) throw new Error(`[hr/holidays] override removal failed: ${error.message}`);

  await writeAudit(actor.employeeId, actor.orgId, "working_day_override.removed",
    "hr_working_day_overrides", null, { date }, null);
}
