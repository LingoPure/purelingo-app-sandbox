"use server";

import { revalidatePath } from "next/cache";
import {
  submitRequest,
  approveRequest,
  declineRequest,
  cancelRequest,
  previewRequest,
  type PreviewResult,
} from "@/lib/hr/requests";
import { HrAuthError } from "@/lib/hr/auth";
import { isDateOnly } from "@/lib/hr/dates";
import type { HrHalfDay } from "@/lib/hr/types";
import type { ActionResult } from "./actions";

/**
 * Server actions for the leave request surfaces.
 *
 * Authorisation is not re-derived here. Every action delegates to
 * `src/lib/hr/requests.ts`, which gates before it writes. The rules are covered
 * by `npm run test:hr:integration`, and a second copy of a rule in this file
 * would become a different rule the first time one of them was edited.
 */

function toMessage(error: unknown): string {
  if (error instanceof HrAuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function parseHalf(value: FormDataEntryValue | null): HrHalfDay | null {
  const raw = String(value ?? "").trim();
  if (raw === "am" || raw === "pm") return raw;
  return null;
}

export type PreviewState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ready"; preview: PreviewResult };

/**
 * The live figure on the submit form.
 *
 * The requirement asks to show the number of requested days and the expected
 * balance BEFORE submission, so this has to be callable without writing
 * anything. It returns blockers rather than throwing, because a form that
 * explodes on an invalid date range loses everything the user typed.
 */
export async function previewRequestAction(
  employeeId: string,
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  startHalf: string | null,
  endHalf: string | null
): Promise<PreviewState> {
  try {
    if (!employeeId || !leaveTypeId) return { status: "idle" };
    if (!isDateOnly(startDate) || !isDateOnly(endDate)) return { status: "idle" };
    if (endDate < startDate) {
      return { status: "error", error: "The end date is before the start date." };
    }

    const preview = await previewRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      startHalf: parseHalf(startHalf),
      endHalf: parseHalf(endHalf),
    });
    return { status: "ready", preview };
  } catch (error) {
    return { status: "error", error: toMessage(error) };
  }
}

export async function submitRequestAction(form: FormData): Promise<ActionResult> {
  try {
    const employeeId = String(form.get("employeeId") ?? "").trim();
    const leaveTypeId = String(form.get("leaveTypeId") ?? "").trim();
    const startDate = String(form.get("startDate") ?? "").trim();
    const endDate = String(form.get("endDate") ?? "").trim();

    if (!leaveTypeId) return { ok: false, error: "Choose a leave type." };
    if (!isDateOnly(startDate) || !isDateOnly(endDate)) {
      return { ok: false, error: "Choose a valid start and end date." };
    }
    if (endDate < startDate) {
      return { ok: false, error: "The end date is before the start date." };
    }

    const request = await submitRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      startHalf: parseHalf(form.get("startHalf")),
      endHalf: parseHalf(form.get("endHalf")),
      reason: String(form.get("reason") ?? "").trim() || null,
    });

    revalidatePath("/hr");
    revalidatePath("/hr/requests");
    revalidatePath("/hr/approvals");

    return {
      ok: true,
      message:
        `Request submitted for ${request.requestedDays} ` +
        `${request.requestedDays === 1 ? "day" : "days"}. ` +
        `Your manager has been notified.`,
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function approveRequestAction(form: FormData): Promise<ActionResult> {
  try {
    const requestId = String(form.get("requestId") ?? "").trim();
    const note = String(form.get("note") ?? "").trim() || undefined;
    const result = await approveRequest(requestId, note);

    revalidatePath("/hr");
    revalidatePath("/hr/approvals");
    revalidatePath("/hr/requests");

    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true, message: "Approved. The balance has been updated." };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function declineRequestAction(form: FormData): Promise<ActionResult> {
  try {
    const requestId = String(form.get("requestId") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    // A decline without a reason is the thing people complain about, and the
    // person receiving it cannot ask the system why.
    if (!note) {
      return { ok: false, error: "Give a short reason so they know why." };
    }

    const result = await declineRequest(requestId, note);
    revalidatePath("/hr");
    revalidatePath("/hr/approvals");
    revalidatePath("/hr/requests");

    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true, message: "Declined. They have been notified." };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function cancelRequestAction(form: FormData): Promise<ActionResult> {
  try {
    const requestId = String(form.get("requestId") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim() || undefined;
    const result = await cancelRequest(requestId, reason);

    revalidatePath("/hr");
    revalidatePath("/hr/requests");
    revalidatePath("/hr/approvals");

    if (!result.ok) return { ok: false, error: result.message };
    return {
      ok: true,
      message: "Cancelled. Any days that had been deducted are back in your balance.",
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}
