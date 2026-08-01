/**
 * The leave request lifecycle: submit, approve, decline, cancel.
 *
 * THE RACE. Both the assigned Manager and a Super Admin are notified of a
 * request and both can act on it. The requirement states the consequence
 * obliquely — "the system must prevent duplicate deductions if the approval
 * action is triggered more than once" — and the fix is two mechanisms, not one:
 *
 *   1. A status-guarded conditional write. `UPDATE … WHERE id = ? AND status =
 *      'pending'` returns zero rows if somebody already decided, so exactly one
 *      caller wins the claim.
 *   2. The partial unique index on `(request_id, entry_type)`, which refuses a
 *      second `request_approved` row even if the first guard were bypassed.
 *
 * Disabling a button is not one of the mechanisms. Two people on two devices
 * never see each other's disabled button.
 *
 * ⚠️ PROVISIONAL BEHAVIOUR. Over-balance handling, minimum notice and
 * self-cancellation all read `hr_org_policy`, which currently holds the
 * recommended defaults rather than confirmed client answers. See
 * docs/HR_MODULE_QUESTIONS_FOR_THAO.md — the answers change rows, not code.
 */

import { hrUserClient, hrServiceClient } from "./deps";
import {
  requireHrEmployee,
  requireCanViewEmployee,
  requireCanApproveFor,
  HrAuthError,
} from "./auth";
import { countLeaveDays, type LeaveCalendar } from "./leave-days";
import { buildLeaveCalendar, getOrgPolicy, getOrgTimezone, listLeaveTypes } from "./policy";
import { getBalanceForAsService } from "./balances";
import { leaveYearOf, todayInTimeZone, type DateOnly } from "./dates";
import { writeAudit } from "./employees";
import type { HrHalfDay, HrLeaveRequest, HrRequestStatus, HrOrgPolicy } from "./types";

type RequestRow = {
  id: string;
  org_id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  start_half: HrHalfDay | null;
  end_half: HrHalfDay | null;
  requested_days: string | number;
  reason: string | null;
  status: HrRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

function toRequest(row: RequestRow): HrLeaveRequest {
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    startDate: row.start_date as DateOnly,
    endDate: row.end_date as DateOnly,
    startHalf: row.start_half,
    endHalf: row.end_half,
    requestedDays: Number(row.requested_days),
    reason: row.reason,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
  };
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** Requests the caller may see. RLS scopes it; no role branching here. */
export async function listRequests(options?: {
  employeeId?: string;
  status?: HrRequestStatus;
  limit?: number;
}): Promise<HrLeaveRequest[]> {
  const supabase = await hrUserClient();
  let query = supabase
    .from("hr_leave_requests")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(options?.limit ?? 200);

  if (options?.employeeId) query = query.eq("employee_id", options.employeeId);
  if (options?.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) {
    console.error("[hr/requests] list failed:", error.message);
    return [];
  }
  return (data as unknown as RequestRow[]).map(toRequest);
}

/**
 * Everything awaiting a decision that the caller can act on.
 *
 * RLS already limits the rows to people the caller can see, and a Staff member
 * can only see themselves — so this returns their own pending requests, which
 * they cannot approve. The UI gates on role; this function does not pretend to.
 */
export async function listPendingApprovals(): Promise<HrLeaveRequest[]> {
  const me = await requireHrEmployee();
  const pending = await listRequests({ status: "pending" });
  // An approver never decides their own request; escalation handles those.
  return pending.filter((r) => r.employeeId !== me.employeeId);
}

export async function getRequest(requestId: string): Promise<HrLeaveRequest | null> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_leave_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) return null;
  const request = toRequest(data as unknown as RequestRow);
  await requireCanViewEmployee(request.employeeId);
  return request;
}

// ── Submitting ───────────────────────────────────────────────────────────────

export type SubmitRequestInput = {
  employeeId: string;
  leaveTypeId: string;
  startDate: DateOnly;
  endDate: DateOnly;
  startHalf?: HrHalfDay | null;
  endHalf?: HrHalfDay | null;
  reason?: string | null;
};

export type PreviewResult = {
  days: number;
  explanation: string | null;
  balanceBefore: number;
  balanceAfter: number;
  deductsBalance: boolean;
  /** Non-blocking notes. */
  warnings: string[];
  /** Reasons this cannot be submitted as-is. */
  blockers: string[];
};

/**
 * What this request would cost, and whether it can be submitted.
 *
 * Powers the live figure on the submit form. The requirement asks to show "the
 * number of requested days and the expected balance after approval" BEFORE
 * submission, so the same computation has to be callable without writing
 * anything — hence a preview that returns blockers rather than throwing.
 */
export async function previewRequest(
  input: SubmitRequestInput
): Promise<PreviewResult> {
  const me = await requireHrEmployee();
  await requireCanViewEmployee(input.employeeId);

  const policy = await getOrgPolicy(me.orgId);
  const [calendar, types] = await Promise.all([
    buildLeaveCalendar(me.orgId, input.startDate, input.endDate, policy),
    listLeaveTypes(me.orgId),
  ]);

  const leaveType = types.find((t) => t.id === input.leaveTypeId);
  if (!leaveType) {
    return {
      days: 0,
      explanation: null,
      balanceBefore: 0,
      balanceAfter: 0,
      deductsBalance: false,
      warnings: [],
      blockers: ["That leave type is not available."],
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.endDate < input.startDate) {
    return {
      days: 0,
      explanation: null,
      balanceBefore: 0,
      balanceAfter: 0,
      deductsBalance: leaveType.deductsBalance,
      warnings: [],
      blockers: ["The end date is before the start date."],
    };
  }

  const count = countLeaveDays({
    startDate: input.startDate,
    endDate: input.endDate,
    startHalf: input.startHalf,
    endHalf: input.endHalf,
    calendar,
  });

  const { explainCount } = await import("./leave-days");
  const explanation = explainCount(count);

  if (count.days === 0) {
    blockers.push(
      "Those dates contain no working days, so there is nothing to request."
    );
  }

  const leaveYear = leaveYearOf(input.startDate, policy.leaveYearBasis, undefined);
  const balanceBefore = leaveType.deductsBalance
    ? await getBalanceForAsService(input.employeeId, leaveType.id, leaveYear)
    : 0;
  const balanceAfter = leaveType.deductsBalance
    ? Math.round((balanceBefore - count.days) * 2) / 2
    : 0;

  if (leaveType.deductsBalance && balanceAfter < 0) {
    applyOverBalancePolicy(policy, balanceAfter, blockers, warnings);
  }

  const overlap = await findOverlap(input);
  if (overlap) {
    blockers.push(
      `This overlaps an existing ${overlap.status} request from ${overlap.startDate} to ${overlap.endDate}.`
    );
  }

  if (policy.minNoticeDays > 0 && leaveType.code !== "sick") {
    const timezone = await getOrgTimezone(me.orgId);
    const today = todayInTimeZone(timezone);
    const noticeDays = countLeaveDays({
      startDate: today,
      endDate: input.startDate,
      calendar: await buildLeaveCalendar(me.orgId, today, input.startDate, policy),
    }).days;
    if (input.startDate > today && noticeDays < policy.minNoticeDays) {
      warnings.push(
        `This is short notice — the policy asks for ${policy.minNoticeDays} working days.`
      );
    }
  }

  return {
    days: count.days,
    explanation,
    balanceBefore,
    balanceAfter,
    deductsBalance: leaveType.deductsBalance,
    warnings,
    blockers,
  };
}

/**
 * The over-balance rule, read from policy.
 *
 * ⚠️ Currently `block`, the recommended default. The other two branches are
 * implemented and tested but unexercised until the client chooses one.
 * `spill_to_unpaid` deliberately blocks for now rather than silently converting
 * days to unpaid leave: quietly changing the TYPE of someone's leave — and so
 * whether they get paid for it — is not something to do without being asked.
 */
function applyOverBalancePolicy(
  policy: HrOrgPolicy,
  balanceAfter: number,
  blockers: string[],
  warnings: string[]
): void {
  const short = Math.abs(balanceAfter);
  switch (policy.overBalancePolicy) {
    case "block":
      blockers.push(
        `This is ${short} ${short === 1 ? "day" : "days"} more than you have left. ` +
          `Shorten the request, or submit it as unpaid leave.`
      );
      break;
    case "allow_negative":
      warnings.push(
        `This takes you ${short} ${short === 1 ? "day" : "days"} into a negative balance.`
      );
      break;
    case "spill_to_unpaid":
      blockers.push(
        `This is ${short} ${short === 1 ? "day" : "days"} more than you have left. ` +
          `Automatic conversion to unpaid leave is not enabled yet — split it into ` +
          `two requests, one paid and one unpaid.`
      );
      break;
  }
}

/**
 * An existing pending or approved request covering any of the same dates.
 *
 * Two overlapping requests would each deduct in full, so the same day is paid
 * for twice. Declined and cancelled requests are ignored — they hold no claim
 * on the calendar.
 */
async function findOverlap(
  input: SubmitRequestInput & { excludeRequestId?: string }
): Promise<HrLeaveRequest | null> {
  const supabase = await hrUserClient();
  let query = supabase
    .from("hr_leave_requests")
    .select("*")
    .eq("employee_id", input.employeeId)
    .in("status", ["pending", "approved"])
    // Ranges overlap when each starts before the other ends.
    .lte("start_date", input.endDate)
    .gte("end_date", input.startDate);

  if (input.excludeRequestId) query = query.neq("id", input.excludeRequestId);

  const { data, error } = await query.limit(1);
  if (error || !data?.length) return null;
  return toRequest(data[0] as unknown as RequestRow);
}

/**
 * Submit a request.
 *
 * `requested_days` is computed here and FROZEN on the row. It is never
 * recalculated on read: if a public holiday is added later, a request already
 * decided keeps the figure it was decided on, which is what the ledger recorded
 * and what the employee was told.
 */
export async function submitRequest(
  input: SubmitRequestInput
): Promise<HrLeaveRequest> {
  const me = await requireHrEmployee();

  // Anyone may submit for themselves. Submitting on someone else's behalf is a
  // Super Admin action; a Manager filing leave for a report would let them
  // consume that person's balance without their knowledge.
  if (input.employeeId !== me.employeeId && me.role !== "super_admin") {
    throw new HrAuthError("You can only submit leave for yourself", 403);
  }

  const preview = await previewRequest(input);
  if (preview.blockers.length > 0) {
    throw new HrAuthError(preview.blockers[0], 403);
  }

  const policy = await getOrgPolicy(me.orgId);
  const service = hrServiceClient();

  const { data, error } = await service
    .from("hr_leave_requests")
    .insert({
      org_id: me.orgId,
      employee_id: input.employeeId,
      leave_type_id: input.leaveTypeId,
      start_date: input.startDate,
      end_date: input.endDate,
      start_half: input.startHalf ?? null,
      end_half: input.endHalf ?? null,
      requested_days: preview.days,
      reason: input.reason?.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(`[hr/requests] submit failed: ${error.message}`);

  const request = toRequest(data as unknown as RequestRow);
  await writeAudit(me.employeeId, me.orgId, "request.submitted", "hr_leave_requests",
    request.id, null, { days: preview.days, type: input.leaveTypeId });

  void policy; // policy is read above for validation; retained for clarity
  return request;
}

// ── Deciding ─────────────────────────────────────────────────────────────────

export type DecisionResult =
  | { ok: true; request: HrLeaveRequest }
  | { ok: false; reason: "already_decided" | "error"; message: string };

/**
 * Approve a request and deduct the balance.
 *
 * Order matters. The status is claimed FIRST, then the ledger row is written.
 * If the ledger write fails for any reason other than the duplicate guard, the
 * claim is released — otherwise the request would read as approved while no
 * deduction ever happened, which is the worst of the available outcomes: the
 * employee takes the leave and their balance never moves.
 */
export async function approveRequest(
  requestId: string,
  note?: string
): Promise<DecisionResult> {
  const service = hrServiceClient();

  const existing = await getRequest(requestId);
  if (!existing) return { ok: false, reason: "error", message: "No such request." };

  const approver = await requireCanApproveFor(existing.employeeId);

  // Claim it. Zero rows means somebody else decided between the read above and
  // this write — the whole point of the guard.
  const { data: claimed, error: claimError } = await service
    .from("hr_leave_requests")
    .update({
      status: "approved",
      decided_by: approver.employeeId,
      decided_at: new Date().toISOString(),
      decision_note: note?.trim() || null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimError) {
    return { ok: false, reason: "error", message: claimError.message };
  }
  if (!claimed) {
    return {
      ok: false,
      reason: "already_decided",
      message: "This request has already been decided by someone else.",
    };
  }

  const request = toRequest(claimed as unknown as RequestRow);

  const types = await listLeaveTypes(approver.orgId);
  const leaveType = types.find((t) => t.id === request.leaveTypeId);
  const policy = await getOrgPolicy(approver.orgId);
  const leaveYear = leaveYearOf(request.startDate, policy.leaveYearBasis, undefined);

  // Non-deducting types still get a row, with days = 0. That keeps "every
  // approved request has exactly one request_approved row" true, which is what
  // makes the unique index a meaningful guard for every type rather than only
  // the ones that draw down a balance.
  const days = leaveType?.deductsBalance ? -Math.abs(request.requestedDays) : 0;

  const { error: ledgerError } = await service.from("hr_leave_ledger").insert({
    org_id: request.orgId,
    employee_id: request.employeeId,
    leave_type_id: request.leaveTypeId,
    leave_year: leaveYear,
    entry_type: "request_approved",
    days,
    request_id: request.id,
    effective_date: request.startDate,
    created_by: approver.employeeId,
  });

  if (ledgerError) {
    // 23505 = the duplicate guard fired. Another caller already wrote the
    // deduction, so the end state is correct and this is not a failure.
    if (ledgerError.code === "23505") {
      return { ok: true, request };
    }
    // Anything else: undo the claim rather than leave an approved request with
    // no deduction behind it.
    await service
      .from("hr_leave_requests")
      .update({ status: "pending", decided_by: null, decided_at: null, decision_note: null })
      .eq("id", requestId);
    return {
      ok: false,
      reason: "error",
      message: `Could not record the deduction, so the approval was undone: ${ledgerError.message}`,
    };
  }

  await writeAudit(approver.employeeId, approver.orgId, "request.approved",
    "hr_leave_requests", request.id, { status: "pending" },
    { status: "approved", days });

  return { ok: true, request };
}

/** Decline a request. Writes no ledger row — a declined request costs nothing. */
export async function declineRequest(
  requestId: string,
  note?: string
): Promise<DecisionResult> {
  const service = hrServiceClient();

  const existing = await getRequest(requestId);
  if (!existing) return { ok: false, reason: "error", message: "No such request." };

  const approver = await requireCanApproveFor(existing.employeeId);

  const { data: claimed, error } = await service
    .from("hr_leave_requests")
    .update({
      status: "declined",
      decided_by: approver.employeeId,
      decided_at: new Date().toISOString(),
      decision_note: note?.trim() || null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, reason: "error", message: error.message };
  if (!claimed) {
    return {
      ok: false,
      reason: "already_decided",
      message: "This request has already been decided by someone else.",
    };
  }

  await writeAudit(approver.employeeId, approver.orgId, "request.declined",
    "hr_leave_requests", requestId, { status: "pending" }, { status: "declined" });

  return { ok: true, request: toRequest(claimed as unknown as RequestRow) };
}

/**
 * Cancel a request, restoring the balance if it had been approved.
 *
 * The restore is a compensating `request_cancelled` row, not a deletion or an
 * edit of the original deduction. The ledger stays append-only, so the history
 * shows what happened rather than hiding it: approved, then cancelled, net
 * zero.
 *
 * ⚠️ Who may cancel what is policy (`self_cancel_future`, `self_cancel_past`)
 * and both values are currently the recommended defaults, not client answers.
 */
export async function cancelRequest(
  requestId: string,
  reason?: string
): Promise<DecisionResult> {
  const me = await requireHrEmployee();
  const service = hrServiceClient();

  const existing = await getRequest(requestId);
  if (!existing) return { ok: false, reason: "error", message: "No such request." };

  const policy = await getOrgPolicy(me.orgId);
  const timezone = await getOrgTimezone(me.orgId);
  const today = todayInTimeZone(timezone);
  const isFuture = existing.startDate > today;
  const isOwn = existing.employeeId === me.employeeId;

  if (isOwn && me.role === "staff") {
    if (isFuture && !policy.selfCancelFuture) {
      throw new HrAuthError("Ask your manager to cancel approved leave.", 403);
    }
    if (!isFuture && !policy.selfCancelPast) {
      throw new HrAuthError(
        "Leave that has already started can only be cancelled by a Super Admin.",
        403
      );
    }
  } else if (!isOwn) {
    await requireCanApproveFor(existing.employeeId);
  }

  const { data: claimed, error } = await service
    .from("hr_leave_requests")
    .update({
      status: "cancelled",
      cancelled_by: me.employeeId,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason?.trim() || null,
    })
    .eq("id", requestId)
    .in("status", ["pending", "approved"])
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, reason: "error", message: error.message };
  if (!claimed) {
    return {
      ok: false,
      reason: "already_decided",
      message: "This request has already been cancelled or declined.",
    };
  }

  const request = toRequest(claimed as unknown as RequestRow);

  // Only an APPROVED request ever deducted, so only that one needs restoring.
  if (existing.status === "approved") {
    const leaveYear = leaveYearOf(request.startDate, policy.leaveYearBasis, undefined);
    const types = await listLeaveTypes(me.orgId);
    const leaveType = types.find((t) => t.id === request.leaveTypeId);
    const days = leaveType?.deductsBalance ? Math.abs(request.requestedDays) : 0;

    const { error: ledgerError } = await service.from("hr_leave_ledger").insert({
      org_id: request.orgId,
      employee_id: request.employeeId,
      leave_type_id: request.leaveTypeId,
      leave_year: leaveYear,
      entry_type: "request_cancelled",
      days,
      request_id: request.id,
      effective_date: request.startDate,
      reason: reason?.trim() || null,
      created_by: me.employeeId,
    });

    // 23505 means the restore already exists — idempotent, not a failure.
    if (ledgerError && ledgerError.code !== "23505") {
      await service
        .from("hr_leave_requests")
        .update({ status: "approved", cancelled_by: null, cancelled_at: null })
        .eq("id", requestId);
      return {
        ok: false,
        reason: "error",
        message: `Could not restore the balance, so the cancellation was undone: ${ledgerError.message}`,
      };
    }
  }

  await writeAudit(me.employeeId, me.orgId, "request.cancelled", "hr_leave_requests",
    requestId, { status: existing.status }, { status: "cancelled" });

  return { ok: true, request };
}

/** Who is away on a given date. Powers "who is off today". */
export async function whoIsOff(date: DateOnly): Promise<HrLeaveRequest[]> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_leave_requests")
    .select("*")
    .eq("status", "approved")
    .lte("start_date", date)
    .gte("end_date", date);

  if (error) {
    console.error("[hr/requests] whoIsOff failed:", error.message);
    return [];
  }
  return (data as unknown as RequestRow[]).map(toRequest);
}

export type { LeaveCalendar };
