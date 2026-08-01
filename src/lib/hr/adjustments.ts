/**
 * Manual leave-balance adjustments. Super Admin only.
 *
 * THE DISTINCTION THAT MATTERS. The requirement lists "set an exact remaining
 * balance" and "edit the annual allowance" as separate actions, and they are:
 *
 *   set balance     writes a compensating manual_adjustment for the DELTA
 *                   between the current balance and the target. The ledger
 *                   stays append-only and the history explains the jump.
 *
 *   edit allowance  updates hr_employee_entitlements and writes NO ledger row.
 *                   An allowance is the entitlement, not the balance — someone
 *                   moving from 12 to 14 days has not been GIVEN two days
 *                   retroactively.
 *
 * Conflating them either corrupts the ledger or silently changes what a person
 * is owed. That is why they are separate functions here rather than one
 * "update" with a flag.
 *
 * Every adjustment carries a mandatory reason. The database enforces it too —
 * a CHECK on hr_leave_ledger rejects a manual_adjustment with a null or
 * whitespace-only reason — so the rule holds even if a caller forgets. The
 * validation here exists to give a person a readable error instead of a
 * constraint violation.
 */

import { hrServiceClient } from "./deps";
import { requireHrSuperAdmin, requireCanViewEmployee, HrAuthError } from "./auth";
import { getBalanceForAsService } from "./balances";
import { writeAudit } from "./employees";
import { getOrgTimezone } from "./policy";
import { todayInTimeZone, isDateOnly, type DateOnly } from "./dates";

export type AdjustmentAction = "add" | "deduct" | "set" | "allowance";

export type AdjustmentInput = {
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  action: AdjustmentAction;
  /** Days for add/deduct, the target for set, the new entitlement for allowance. */
  value: number;
  effectiveDate?: DateOnly;
  reason: string;
};

export type AdjustmentPreview = {
  balanceBefore: number;
  balanceAfter: number;
  /** Signed ledger movement. Zero for an allowance edit, and for a no-op set. */
  delta: number;
  allowanceBefore: number | null;
  allowanceAfter: number | null;
  /** True when nothing would be written. */
  noop: boolean;
};

/** Half days are the smallest unit anywhere in this system. */
function assertHalfDay(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new HrAuthError(`${label} must be a number of days, zero or more`, 403);
  }
  if (Math.round(value * 2) !== value * 2) {
    throw new HrAuthError(`${label} must be in whole or half days`, 403);
  }
}

function toHalfDay(value: number): number {
  return Math.round(value * 2) / 2;
}

async function currentAllowance(
  employeeId: string,
  leaveTypeId: string,
  leaveYear: number
): Promise<number | null> {
  const { data } = await hrServiceClient()
    .from("hr_employee_entitlements")
    .select("allowance")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("leave_year", leaveYear)
    .maybeSingle();
  const row = data as unknown as { allowance: string | number } | null;
  return row ? Number(row.allowance) : null;
}

/**
 * What this adjustment would do, without doing it.
 *
 * The requirement asks to "preview the resulting balance before saving", so the
 * same arithmetic has to be callable without writing. Readable by anyone who may
 * view the employee — a Manager can see what a change would mean; only a Super
 * Admin can apply it.
 */
export async function previewAdjustment(
  input: AdjustmentInput
): Promise<AdjustmentPreview> {
  await requireCanViewEmployee(input.employeeId);

  const [balanceBefore, allowanceBefore] = await Promise.all([
    getBalanceForAsService(input.employeeId, input.leaveTypeId, input.leaveYear),
    currentAllowance(input.employeeId, input.leaveTypeId, input.leaveYear),
  ]);

  if (input.action === "allowance") {
    assertHalfDay(input.value, "Allowance");
    return {
      balanceBefore,
      // The remaining balance does NOT move. This is the whole point of keeping
      // allowance and balance separate.
      balanceAfter: balanceBefore,
      delta: 0,
      allowanceBefore,
      allowanceAfter: input.value,
      noop: allowanceBefore === input.value,
    };
  }

  assertHalfDay(input.value, "Days");

  let delta: number;
  if (input.action === "add") delta = input.value;
  else if (input.action === "deduct") delta = -input.value;
  else delta = toHalfDay(input.value - balanceBefore); // set

  return {
    balanceBefore,
    balanceAfter: toHalfDay(balanceBefore + delta),
    delta,
    allowanceBefore,
    allowanceAfter: allowanceBefore,
    noop: delta === 0,
  };
}

/**
 * Apply the adjustment.
 *
 * Scoped to ONE employee by construction: the ledger row carries an employee_id
 * and a balance is the sum of that employee's rows. There is no company-wide or
 * team-wide write path to get wrong, which is what makes the requirement's last
 * criterion ("adjusting one employee does not affect another") structural
 * rather than something to be careful about.
 */
export async function applyAdjustment(
  input: AdjustmentInput
): Promise<AdjustmentPreview> {
  const actor = await requireHrSuperAdmin();

  const reason = input.reason?.trim() ?? "";
  if (!reason) {
    throw new HrAuthError("Give a reason — it is recorded against the employee.", 403);
  }

  const effectiveDate =
    input.effectiveDate && isDateOnly(input.effectiveDate)
      ? input.effectiveDate
      : todayInTimeZone(await getOrgTimezone(actor.orgId));

  const preview = await previewAdjustment(input);
  const service = hrServiceClient();

  if (input.action === "allowance") {
    // No ledger row. An entitlement change is not a balance movement.
    const { error } = await service.from("hr_employee_entitlements").upsert(
      {
        org_id: actor.orgId,
        employee_id: input.employeeId,
        leave_type_id: input.leaveTypeId,
        leave_year: input.leaveYear,
        allowance: input.value,
      },
      { onConflict: "org_id,employee_id,leave_type_id,leave_year" }
    );
    if (error) throw new Error(`[hr/adjustments] allowance failed: ${error.message}`);

    await writeAudit(
      actor.employeeId, actor.orgId, "balance.allowance_changed",
      "hr_employee_entitlements", input.employeeId,
      { allowance: preview.allowanceBefore },
      { allowance: input.value, reason }
    );
    return preview;
  }

  // Re-setting to the value it already holds writes nothing. A zero-day ledger
  // row would be noise in a history whose whole job is to explain movements.
  if (preview.noop) return preview;

  const { error } = await service.from("hr_leave_ledger").insert({
    org_id: actor.orgId,
    employee_id: input.employeeId,
    leave_type_id: input.leaveTypeId,
    leave_year: input.leaveYear,
    entry_type: "manual_adjustment",
    days: preview.delta,
    effective_date: effectiveDate,
    reason,
    created_by: actor.employeeId,
  });
  if (error) throw new Error(`[hr/adjustments] adjustment failed: ${error.message}`);

  await writeAudit(
    actor.employeeId, actor.orgId, "balance.adjusted", "hr_leave_ledger",
    input.employeeId,
    { balance: preview.balanceBefore },
    {
      balance: preview.balanceAfter,
      days: preview.delta,
      action: input.action,
      effective_date: effectiveDate,
      reason,
    }
  );

  return preview;
}
