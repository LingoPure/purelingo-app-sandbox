/**
 * HR integration tests — the authorisation and lifecycle logic that lives in
 * TypeScript rather than SQL.
 *
 * These close the gap the SQL harness cannot reach. `scripts/hr-db-verify.sh`
 * proves the CONSTRAINTS hold; nothing there executes a line of
 * `requests.ts` or `employees.ts`. Everything below drives the real exported
 * functions, as real users, against a real Supabase with real RLS.
 *
 * Run: npm run test:hr:integration
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  setupTestContext,
  teardownTestContext,
  actAs,
  setPolicy,
  serviceClient,
  nextMonday,
  addDays,
  type TestContext,
} from "./harness";

import { listEmployees, getEmployee, updateEmployee, deactivateEmployee } from "../../src/lib/hr/employees";
import {
  submitRequest,
  approveRequest,
  declineRequest,
  cancelRequest,
  previewRequest,
} from "../../src/lib/hr/requests";
import { getBalanceForAsService } from "../../src/lib/hr/balances";
import { HrAuthError } from "../../src/lib/hr/auth";

let ctx: TestContext;
const YEAR = new Date().getUTCFullYear();

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  if (ctx) await teardownTestContext(ctx);
});

/** Count ledger rows of a given kind for a request. */
async function ledgerRowsFor(requestId: string, entryType: string): Promise<number> {
  const { data } = await serviceClient()
    .from("hr_leave_ledger")
    .select("id")
    .eq("request_id", requestId)
    .eq("entry_type", entryType);
  return (data ?? []).length;
}

async function annualBalance(employeeId: string): Promise<number> {
  return getBalanceForAsService(employeeId, ctx.leaveTypes.annual, YEAR);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("RLS through the real functions", () => {
  test("staff see only themselves", async () => {
    actAs(ctx.staff);
    const visible = await listEmployees();
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, ctx.staff.employeeId);
  });

  test("a manager sees their own reports plus themselves, and nobody else", async () => {
    actAs(ctx.manager);
    const visible = await listEmployees();
    const ids = new Set(visible.map((e) => e.id));
    assert.equal(visible.length, 3);
    assert.ok(ids.has(ctx.manager.employeeId));
    assert.ok(ids.has(ctx.staff.employeeId));
    assert.ok(ids.has(ctx.staffPeer.employeeId));
    assert.ok(!ids.has(ctx.otherManager.employeeId), "must not see a peer manager");
    assert.ok(!ids.has(ctx.superAdmin.employeeId), "must not see the super admin");
  });

  test("a manager with no reports sees only themselves", async () => {
    actAs(ctx.otherManager);
    const visible = await listEmployees();
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, ctx.otherManager.employeeId);
  });

  test("a super admin sees the whole org and nothing outside it", async () => {
    actAs(ctx.superAdmin);
    const visible = await listEmployees();
    assert.equal(visible.length, 5);
    assert.ok(!visible.some((e) => e.id === ctx.outsider.employeeId));
  });

  test("reading another team's employee is refused, not silently empty", async () => {
    actAs(ctx.otherManager);
    await assert.rejects(
      () => getEmployee(ctx.staff.employeeId),
      (error: unknown) => error instanceof HrAuthError && error.status === 403
    );
  });

  test("an outsider cannot reach this org at all", async () => {
    actAs(ctx.outsider);
    const visible = await listEmployees();
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, ctx.outsider.employeeId);
  });
});

describe("Employee administration gates", () => {
  test("a manager cannot change roles", async () => {
    actAs(ctx.manager);
    await assert.rejects(
      () => updateEmployee(ctx.staff.employeeId, { hrRole: "super_admin" }),
      (error: unknown) => error instanceof HrAuthError && error.status === 403
    );
  });

  test("staff cannot deactivate anyone", async () => {
    actAs(ctx.staff);
    await assert.rejects(
      () => deactivateEmployee(ctx.staffPeer.employeeId),
      (error: unknown) => error instanceof HrAuthError && error.status === 403
    );
  });

  test("a super admin cannot deactivate themselves", async () => {
    // Otherwise the last Super Admin can lock the whole organisation out of its
    // own administration with one click.
    actAs(ctx.superAdmin);
    await assert.rejects(
      () => deactivateEmployee(ctx.superAdmin.employeeId),
      (error: unknown) => error instanceof HrAuthError && /your own account/i.test(error.message)
    );
  });

  test("a staff member cannot be assigned as a manager", async () => {
    actAs(ctx.superAdmin);
    await assert.rejects(
      () => updateEmployee(ctx.staffPeer.employeeId, { managerId: ctx.staff.employeeId }),
      (error: unknown) => error instanceof HrAuthError && /Staff member cannot manage/i.test(error.message)
    );
  });

  test("a management cycle is rejected", async () => {
    // manager already manages staff. Making manager report to staff would close
    // the loop, and any code walking the reporting line would then hang.
    actAs(ctx.superAdmin);
    await updateEmployee(ctx.staff.employeeId, { hrRole: "admin" });
    await assert.rejects(
      () => updateEmployee(ctx.manager.employeeId, { managerId: ctx.staff.employeeId }),
      (error: unknown) => error instanceof HrAuthError && /cycle/i.test(error.message)
    );
    await updateEmployee(ctx.staff.employeeId, { hrRole: "staff" });
  });

  test("an employee cannot be made their own manager", async () => {
    actAs(ctx.superAdmin);
    await assert.rejects(
      () => updateEmployee(ctx.staff.employeeId, { managerId: ctx.staff.employeeId }),
      (error: unknown) => error instanceof HrAuthError
    );
  });
});

describe("Request lifecycle", () => {
  test("declining writes no ledger row and leaves the balance untouched", async () => {
    const before = await annualBalance(ctx.staff.employeeId);

    actAs(ctx.staff);
    const request = await submitRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(2),
      endDate: addDays(nextMonday(2), 1),
    });

    actAs(ctx.manager);
    const result = await declineRequest(request.id, "Not this week");
    assert.equal(result.ok, true);

    assert.equal(await ledgerRowsFor(request.id, "request_approved"), 0);
    assert.equal(await annualBalance(ctx.staff.employeeId), before);
  });

  test("approving deducts exactly once, and cancelling restores exactly", async () => {
    const before = await annualBalance(ctx.staff.employeeId);

    actAs(ctx.staff);
    const request = await submitRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(3),
      endDate: addDays(nextMonday(3), 1), // Mon + Tue = 2 working days
    });
    assert.equal(request.requestedDays, 2);

    actAs(ctx.manager);
    const approved = await approveRequest(request.id);
    assert.equal(approved.ok, true);
    assert.equal(await ledgerRowsFor(request.id, "request_approved"), 1);
    assert.equal(await annualBalance(ctx.staff.employeeId), before - 2);

    const cancelled = await cancelRequest(request.id, "Plans changed");
    assert.equal(cancelled.ok, true);
    assert.equal(await ledgerRowsFor(request.id, "request_cancelled"), 1);
    assert.equal(
      await annualBalance(ctx.staff.employeeId),
      before,
      "cancelling must restore the balance to its exact pre-approval value"
    );
  });

  test("two approvers acting at once produce ONE approval and ONE ledger row", async () => {
    // The failure this whole design exists to prevent: both the assigned
    // manager and a super admin are notified, both click approve, and the
    // employee loses the days twice.
    const before = await annualBalance(ctx.staffPeer.employeeId);

    actAs(ctx.staffPeer);
    const request = await submitRequest({
      employeeId: ctx.staffPeer.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(4),
      endDate: addDays(nextMonday(4), 2), // 3 working days
    });
    assert.equal(request.requestedDays, 3);

    // Fire both concurrently. Each installs its own actor immediately before
    // awaiting, so the two calls genuinely overlap in the database.
    const results = await Promise.all([
      (async () => {
        actAs(ctx.manager);
        return approveRequest(request.id);
      })(),
      (async () => {
        actAs(ctx.superAdmin);
        return approveRequest(request.id);
      })(),
    ]);

    const succeeded = results.filter((r) => r.ok).length;
    const rejected = results.filter((r) => !r.ok && r.reason === "already_decided").length;

    assert.equal(
      await ledgerRowsFor(request.id, "request_approved"),
      1,
      "exactly one deduction may exist, however many approvals were attempted"
    );
    assert.equal(
      await annualBalance(ctx.staffPeer.employeeId),
      before - 3,
      "the balance must move once, not twice"
    );
    assert.ok(succeeded >= 1, "at least one approval must succeed");
    assert.ok(
      succeeded + rejected === 2,
      `both calls must resolve cleanly; got ${succeeded} ok and ${rejected} already-decided`
    );
  });

  test("approving an already-decided request reports it rather than double-deducting", async () => {
    actAs(ctx.staff);
    const request = await submitRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(5),
      endDate: nextMonday(5),
    });

    actAs(ctx.manager);
    const first = await approveRequest(request.id);
    assert.equal(first.ok, true);

    const second = await approveRequest(request.id);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "already_decided");
    assert.equal(await ledgerRowsFor(request.id, "request_approved"), 1);
  });

  test("overlapping requests are rejected", async () => {
    const start = nextMonday(6);
    actAs(ctx.staff);
    await submitRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: start,
      endDate: addDays(start, 2),
    });

    await assert.rejects(
      () =>
        submitRequest({
          employeeId: ctx.staff.employeeId,
          leaveTypeId: ctx.leaveTypes.annual,
          startDate: addDays(start, 1), // lands inside the existing range
          endDate: addDays(start, 3),
        }),
      (error: unknown) => error instanceof HrAuthError && /overlaps/i.test(error.message)
    );
  });

  test("staff cannot approve anything, including their own request", async () => {
    actAs(ctx.staff);
    const request = await submitRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(8),
      endDate: nextMonday(8),
    });

    await assert.rejects(
      () => approveRequest(request.id),
      (error: unknown) => error instanceof HrAuthError && error.status === 403
    );
    assert.equal(await ledgerRowsFor(request.id, "request_approved"), 0);
  });

  test("a manager cannot approve for someone outside their team", async () => {
    actAs(ctx.staff);
    const request = await submitRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(9),
      endDate: nextMonday(9),
    });

    actAs(ctx.otherManager);
    const result = await approveRequest(request.id);

    // Refused as NOT FOUND rather than as forbidden, and that distinction is
    // deliberate. approveRequest reads the request through the user-scoped
    // client first, so RLS hides it entirely from a manager outside the team.
    // Answering "you may not approve this" would confirm that a request with
    // that id exists and who it belongs to, which is more than an unauthorised
    // caller should learn from a URL. Same reasoning as the 404-not-403 choice
    // on the employee detail page.
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "error");
      assert.match(result.message, /No such request/i);
    }

    // What actually matters: no deduction happened.
    assert.equal(await ledgerRowsFor(request.id, "request_approved"), 0);

    // And the request is still awaiting a decision from someone entitled to make it.
    const { data: after } = await serviceClient()
      .from("hr_leave_requests")
      .select("status")
      .eq("id", request.id)
      .maybeSingle();
    assert.equal((after as { status: string } | null)?.status, "pending");
  });

  test("unpaid leave writes a zero-day row and never touches the paid balance", async () => {
    const before = await annualBalance(ctx.staffPeer.employeeId);

    actAs(ctx.staffPeer);
    const request = await submitRequest({
      employeeId: ctx.staffPeer.employeeId,
      leaveTypeId: ctx.leaveTypes.unpaid,
      startDate: nextMonday(10),
      endDate: addDays(nextMonday(10), 1),
    });

    actAs(ctx.superAdmin);
    const approved = await approveRequest(request.id);
    assert.equal(approved.ok, true);

    // The row still exists, keeping "every approved request has exactly one
    // request_approved row" true — which is what makes the unique index a
    // meaningful guard for every leave type.
    assert.equal(await ledgerRowsFor(request.id, "request_approved"), 1);
    assert.equal(await annualBalance(ctx.staffPeer.employeeId), before);
  });
});

describe("Over-balance policy", () => {
  test("block refuses a request larger than the remaining balance", async () => {
    await setPolicy(ctx.orgId, { over_balance_policy: "block" });
    actAs(ctx.staff);

    const start = nextMonday(20);
    const preview = await previewRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: start,
      endDate: addDays(start, 40), // far more working days than 12
    });

    assert.ok(preview.days > 12);
    assert.ok(
      preview.blockers.some((b) => /more than you have left/i.test(b)),
      `expected an over-balance blocker, got ${JSON.stringify(preview.blockers)}`
    );
  });

  test("allow_negative warns instead of blocking", async () => {
    await setPolicy(ctx.orgId, { over_balance_policy: "allow_negative" });
    actAs(ctx.staff);

    const start = nextMonday(20);
    const preview = await previewRequest({
      employeeId: ctx.staff.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: start,
      endDate: addDays(start, 40),
    });

    assert.equal(preview.blockers.length, 0);
    assert.ok(preview.warnings.some((w) => /negative balance/i.test(w)));

    await setPolicy(ctx.orgId, { over_balance_policy: "block" });
  });
});

describe("Deactivation", () => {
  test("deactivating declines pending requests and keeps the history", async () => {
    actAs(ctx.staffPeer);
    const pending = await submitRequest({
      employeeId: ctx.staffPeer.employeeId,
      leaveTypeId: ctx.leaveTypes.annual,
      startDate: nextMonday(12),
      endDate: nextMonday(12),
    });

    const balanceBefore = await annualBalance(ctx.staffPeer.employeeId);

    actAs(ctx.superAdmin);
    const result = await deactivateEmployee(ctx.staffPeer.employeeId);
    assert.equal(result.employee.status, "deactivated");
    assert.ok(result.declinedRequests >= 1, "the pending request must be declined");

    const { data: after } = await serviceClient()
      .from("hr_leave_requests")
      .select("status")
      .eq("id", pending.id)
      .maybeSingle();
    assert.equal((after as { status: string } | null)?.status, "declined");

    // Declining writes nothing, so the balance is unchanged — and the ledger
    // history survives deactivation, which is what makes a final-pay question
    // answerable months later.
    assert.equal(await annualBalance(ctx.staffPeer.employeeId), balanceBefore);
  });

  test("a deactivated employee resolves to no HR identity", async () => {
    actAs(ctx.staffPeer);
    const visible = await listEmployees();
    assert.equal(visible.length, 0, "a deactivated person has no HR identity at all");
  });
});
