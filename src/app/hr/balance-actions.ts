"use server";

import { revalidatePath } from "next/cache";
import {
  previewAdjustment,
  applyAdjustment,
  type AdjustmentAction,
  type AdjustmentPreview,
} from "@/lib/hr/adjustments";
import { HrAuthError } from "@/lib/hr/auth";
import { isDateOnly } from "@/lib/hr/dates";
import type { ActionResult } from "./actions";

function toMessage(error: unknown): string {
  if (error instanceof HrAuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function parseAction(value: string): AdjustmentAction {
  if (value === "add" || value === "deduct" || value === "set" || value === "allowance") {
    return value;
  }
  throw new HrAuthError("Unrecognised adjustment type", 403);
}

export type PreviewState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ready"; preview: AdjustmentPreview };

/**
 * The live preview.
 *
 * Returns an error state rather than throwing, so a half-typed number does not
 * blow away everything the operator has entered.
 */
export async function previewAdjustmentAction(
  employeeId: string,
  leaveTypeId: string,
  leaveYear: number,
  action: string,
  value: string
): Promise<PreviewState> {
  try {
    if (!employeeId || !leaveTypeId) return { status: "idle" };
    const raw = value.trim();
    if (raw === "") return { status: "idle" };

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return { status: "idle" };

    const preview = await previewAdjustment({
      employeeId,
      leaveTypeId,
      leaveYear,
      action: parseAction(action),
      value: parsed,
      reason: "preview",
    });
    return { status: "ready", preview };
  } catch (error) {
    return { status: "error", error: toMessage(error) };
  }
}

export async function applyAdjustmentAction(form: FormData): Promise<ActionResult> {
  try {
    const employeeId = String(form.get("employeeId") ?? "").trim();
    const leaveTypeId = String(form.get("leaveTypeId") ?? "").trim();
    const leaveYear = Number(form.get("leaveYear"));
    const action = parseAction(String(form.get("action") ?? ""));
    const value = Number(String(form.get("value") ?? "").trim());
    const effectiveDate = String(form.get("effectiveDate") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();

    if (!Number.isInteger(leaveYear)) {
      return { ok: false, error: "Choose a leave year." };
    }
    if (!Number.isFinite(value)) {
      return { ok: false, error: "Enter a number of days." };
    }
    // Checked here as well as in the database so the operator gets a sentence
    // rather than a constraint violation.
    if (!reason) {
      return { ok: false, error: "Give a reason — it is recorded against the employee." };
    }
    if (effectiveDate && !isDateOnly(effectiveDate)) {
      return { ok: false, error: "The effective date is not a real date." };
    }

    const result = await applyAdjustment({
      employeeId,
      leaveTypeId,
      leaveYear,
      action,
      value,
      effectiveDate: effectiveDate || undefined,
      reason,
    });

    revalidatePath(`/hr/team/${employeeId}`);
    revalidatePath("/hr");
    revalidatePath("/hr/requests");

    if (result.noop) {
      return {
        ok: true,
        message:
          action === "allowance"
            ? "The allowance was already that value — nothing changed."
            : "The balance was already that value — nothing was recorded.",
      };
    }

    if (action === "allowance") {
      return {
        ok: true,
        message: `Allowance set to ${result.allowanceAfter}. The remaining balance is unchanged.`,
      };
    }

    return {
      ok: true,
      message: `Balance is now ${result.balanceAfter} (was ${result.balanceBefore}).`,
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}
