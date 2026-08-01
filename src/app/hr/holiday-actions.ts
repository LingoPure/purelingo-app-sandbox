"use server";

import { revalidatePath } from "next/cache";
import {
  createHoliday,
  deleteHolidayGroup,
  setWorkingDayOverride,
  removeWorkingDayOverride,
} from "@/lib/hr/holidays";
import { HrAuthError } from "@/lib/hr/auth";
import { isDateOnly } from "@/lib/hr/dates";
import type { ActionResult } from "./actions";

function toMessage(error: unknown): string {
  if (error instanceof HrAuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function revalidateCalendarSurfaces(): void {
  revalidatePath("/hr");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr/holidays");
}

export async function createHolidayAction(form: FormData): Promise<ActionResult> {
  try {
    const startDate = String(form.get("startDate") ?? "").trim();
    const rawEnd = String(form.get("endDate") ?? "").trim();
    const nameEn = String(form.get("nameEn") ?? "").trim();
    const nameVi = String(form.get("nameVi") ?? "").trim();

    if (!isDateOnly(startDate)) return { ok: false, error: "Choose a valid first day." };
    if (rawEnd && !isDateOnly(rawEnd)) return { ok: false, error: "Choose a valid last day." };
    if (!nameEn) return { ok: false, error: "Give the holiday a name." };

    const result = await createHoliday({
      startDate,
      endDate: rawEnd || null,
      nameEn,
      nameVi,
      isRecurring: form.get("isRecurring") === "on",
    });

    revalidateCalendarSurfaces();

    // Skipped dates are reported rather than swallowed. Silently adding four of
    // five days looks like it worked, and the fifth turns up as a leave day
    // somebody was charged for.
    const skipped =
      result.skipped > 0
        ? ` ${result.skipped} ${result.skipped === 1 ? "date was" : "dates were"} already on the calendar and left unchanged.`
        : "";
    return {
      ok: true,
      message: `${nameEn} added across ${result.created} ${result.created === 1 ? "day" : "days"}.${skipped}`,
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function deleteHolidayAction(form: FormData): Promise<ActionResult> {
  try {
    const nameEn = String(form.get("nameEn") ?? "").trim();
    const startDate = String(form.get("startDate") ?? "").trim();
    const endDate = String(form.get("endDate") ?? "").trim();

    if (!nameEn || !isDateOnly(startDate) || !isDateOnly(endDate)) {
      return { ok: false, error: "That holiday could not be identified." };
    }

    const removed = await deleteHolidayGroup(nameEn, startDate, endDate);
    revalidateCalendarSurfaces();
    return {
      ok: true,
      message: `Removed ${removed} ${removed === 1 ? "day" : "days"}. Leave already approved keeps the day count it was approved on.`,
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function setOverrideAction(form: FormData): Promise<ActionResult> {
  try {
    const date = String(form.get("date") ?? "").trim();
    const kind = String(form.get("kind") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    if (!isDateOnly(date)) return { ok: false, error: "Choose a valid date." };
    if (kind !== "working" && kind !== "closed") {
      return { ok: false, error: "Choose whether this day is worked or not." };
    }

    await setWorkingDayOverride(date, kind === "working", note || null);
    revalidateCalendarSurfaces();

    return {
      ok: true,
      message:
        kind === "working"
          ? `${date} now counts as a working day.`
          : `${date} is now a company closure and will not be deducted from anyone's leave.`,
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function removeOverrideAction(form: FormData): Promise<ActionResult> {
  try {
    const date = String(form.get("date") ?? "").trim();
    if (!isDateOnly(date)) return { ok: false, error: "That date could not be identified." };

    await removeWorkingDayOverride(date);
    revalidateCalendarSurfaces();
    return { ok: true, message: `${date} follows the normal working pattern again.` };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}
