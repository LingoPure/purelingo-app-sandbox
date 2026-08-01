/**
 * Balances, projected from the ledger.
 *
 * There is no stored balance anywhere in this schema. A balance is
 * `SUM(hr_leave_ledger.days)` for one employee, leave type and leave year, and
 * it is computed on every read.
 *
 * That is a deliberate trade of a little query cost for the thing a stored
 * total can never offer: it cannot drift. A running column is wrong the first
 * time any write path forgets to update it, and from then on there is nothing
 * to reconcile it against — you cannot tell whether the column or the history
 * is the lie. Here the history IS the balance, so the question does not arise.
 */

import { hrUserClient, hrServiceClient } from "./deps";
import { requireCanViewEmployee } from "./auth";
import type { DateOnly } from "./dates";
import type { HrLedgerEntry, HrLedgerEntryType, HrLeaveType } from "./types";

export type LeaveBalance = {
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveYear: number;
  /** The entitlement for the year, if one has been set. */
  allowance: number | null;
  /** Sum of every ledger row. This IS the balance. */
  remaining: number;
  /** Days consumed by approved requests. Reported separately for display. */
  taken: number;
  /** Whether this type draws down a balance at all. */
  deductsBalance: boolean;
};

type LedgerRow = {
  id: string;
  org_id: string;
  employee_id: string;
  leave_type_id: string;
  leave_year: number;
  entry_type: HrLedgerEntryType;
  days: string | number;
  request_id: string | null;
  effective_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

function toEntry(row: LedgerRow): HrLedgerEntry {
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    leaveYear: row.leave_year,
    entryType: row.entry_type,
    // numeric comes back as a string over the wire; Number() before any
    // arithmetic, or "12" + "-2" silently concatenates.
    days: Number(row.days),
    requestId: row.request_id,
    effectiveDate: row.effective_date as DateOnly,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Round to the nearest half day, killing float drift from repeated addition. */
function toHalfDay(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Every balance for one employee in one leave year.
 *
 * Gated: reading someone's balance is reading their leave history.
 */
export async function getBalances(
  employeeId: string,
  leaveYear: number,
  leaveTypes: HrLeaveType[]
): Promise<LeaveBalance[]> {
  await requireCanViewEmployee(employeeId);
  const supabase = await hrUserClient();

  const [ledgerResult, entitlementResult] = await Promise.all([
    supabase
      .from("hr_leave_ledger")
      .select("leave_type_id, entry_type, days")
      .eq("employee_id", employeeId)
      .eq("leave_year", leaveYear),
    supabase
      .from("hr_employee_entitlements")
      .select("leave_type_id, allowance")
      .eq("employee_id", employeeId)
      .eq("leave_year", leaveYear),
  ]);

  if (ledgerResult.error) {
    console.error("[hr/balances] ledger read failed:", ledgerResult.error.message);
  }

  const rows = (ledgerResult.data ?? []) as unknown as Array<{
    leave_type_id: string;
    entry_type: HrLedgerEntryType;
    days: string | number;
  }>;

  const entitlements = new Map<string, number>();
  for (const row of (entitlementResult.data ?? []) as unknown as Array<{
    leave_type_id: string;
    allowance: string | number;
  }>) {
    entitlements.set(row.leave_type_id, Number(row.allowance));
  }

  const remainingByType = new Map<string, number>();
  const takenByType = new Map<string, number>();

  for (const row of rows) {
    const days = Number(row.days);
    remainingByType.set(
      row.leave_type_id,
      (remainingByType.get(row.leave_type_id) ?? 0) + days
    );
    // "Taken" counts approvals net of cancellations, so a cancelled request
    // stops showing as consumed rather than lingering as a phantom.
    if (row.entry_type === "request_approved") {
      takenByType.set(row.leave_type_id, (takenByType.get(row.leave_type_id) ?? 0) + Math.abs(days));
    }
    if (row.entry_type === "request_cancelled") {
      takenByType.set(row.leave_type_id, (takenByType.get(row.leave_type_id) ?? 0) - Math.abs(days));
    }
  }

  return leaveTypes.map((type) => ({
    leaveTypeId: type.id,
    leaveTypeCode: type.code,
    leaveTypeName: type.nameEn,
    leaveYear,
    allowance: entitlements.get(type.id) ?? type.defaultAllowance,
    remaining: toHalfDay(remainingByType.get(type.id) ?? 0),
    taken: toHalfDay(Math.max(0, takenByType.get(type.id) ?? 0)),
    deductsBalance: type.deductsBalance,
  }));
}

/** One balance, for the pre-submit check. */
export async function getBalanceFor(
  employeeId: string,
  leaveTypeId: string,
  leaveYear: number
): Promise<number> {
  await requireCanViewEmployee(employeeId);
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_leave_ledger")
    .select("days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("leave_year", leaveYear);

  if (error) {
    console.error("[hr/balances] single balance read failed:", error.message);
    return 0;
  }

  const total = ((data ?? []) as unknown as Array<{ days: string | number }>).reduce(
    (sum, row) => sum + Number(row.days),
    0
  );
  return toHalfDay(total);
}

/** Service-role variant for write paths that have already gated the caller. */
export async function getBalanceForAsService(
  employeeId: string,
  leaveTypeId: string,
  leaveYear: number
): Promise<number> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_leave_ledger")
    .select("days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("leave_year", leaveYear);

  const total = ((data ?? []) as unknown as Array<{ days: string | number }>).reduce(
    (sum, row) => sum + Number(row.days),
    0
  );
  return toHalfDay(total);
}

/**
 * The full ledger for one employee — the "leave adjustment history" the
 * requirement asks for, plus every other movement.
 *
 * Returned newest-first with the running balance attached at each row, so the
 * UI can show "12.0 → 10.0" without recomputing. The running total is derived
 * by walking OLDEST to newest, then reversing: computing it in display order
 * would need the final balance up front, which is the number being derived.
 */
export async function getLedgerHistory(
  employeeId: string,
  leaveYear: number
): Promise<Array<HrLedgerEntry & { balanceAfter: number }>> {
  await requireCanViewEmployee(employeeId);
  const supabase = await hrUserClient();

  const { data, error } = await supabase
    .from("hr_leave_ledger")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("leave_year", leaveYear)
    .order("effective_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[hr/balances] history read failed:", error.message);
    return [];
  }

  let running = 0;
  const ascending = (data as unknown as LedgerRow[]).map((row) => {
    const entry = toEntry(row);
    running = toHalfDay(running + entry.days);
    return { ...entry, balanceAfter: running };
  });

  return ascending.reverse();
}

/** Manual adjustments only — the audit view the requirement names explicitly. */
export async function getAdjustmentHistory(
  employeeId: string,
  leaveYear: number
): Promise<Array<HrLedgerEntry & { balanceAfter: number }>> {
  const all = await getLedgerHistory(employeeId, leaveYear);
  return all.filter((entry) => entry.entryType === "manual_adjustment");
}
