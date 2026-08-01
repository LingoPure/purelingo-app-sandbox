/**
 * Employee records: read, create, update, deactivate, role assignment.
 *
 * READS use the user-scoped client, so the RLS policies from
 * 0027_hr_01_foundation.sql do the filtering. `listEmployees()` returns a
 * different set for a Super Admin, an Admin and a Staff member without a single
 * conditional in this file — the database already decided. That is the whole
 * reason the permission model lives in SQL.
 *
 * WRITES use the service-role client, and every one of them goes through an
 * explicit gate first. No table has an authenticated write policy, so a write
 * that forgets its gate does not quietly succeed with reduced scope; it is
 * simply the only thing standing between the caller and the row.
 */

import { hrUserClient, hrServiceClient } from "./deps";
import { requireHrSuperAdmin, requireCanViewEmployee, HrAuthError } from "./auth";
import { yearOf, todayInTimeZone, type DateOnly } from "./dates";
import type { HrEmployee, HrRole, HrLocale, HrEmployeeStatus } from "./types";

type EmployeeRow = {
  id: string;
  org_id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  department: string | null;
  hr_role: HrRole;
  manager_id: string | null;
  employment_start_date: string;
  employment_end_date: string | null;
  status: HrEmployeeStatus;
  locale: HrLocale | null;
  invited_at: string | null;
  invite_accepted_at: string | null;
};

const EMPLOYEE_COLUMNS =
  "id, org_id, auth_user_id, email, first_name, last_name, job_title, " +
  "department, hr_role, manager_id, employment_start_date, " +
  "employment_end_date, status, locale, invited_at, invite_accepted_at";

function toEmployee(row: EmployeeRow): HrEmployee {
  return {
    id: row.id,
    orgId: row.org_id,
    authUserId: row.auth_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    jobTitle: row.job_title,
    department: row.department,
    hrRole: row.hr_role,
    managerId: row.manager_id,
    employmentStartDate: row.employment_start_date,
    employmentEndDate: row.employment_end_date,
    status: row.status,
    locale: row.locale,
    invitedAt: row.invited_at,
    inviteAcceptedAt: row.invite_accepted_at,
  };
}

export function displayName(employee: HrEmployee): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

/**
 * Every employee the caller is permitted to see.
 *
 * Deliberately has no role branching. A Staff member gets one row, an Admin
 * gets their reports plus themselves, a Super Admin gets the org — all from the
 * same query, because `hr_employees_read` calls `hr_can_view_employee(id)`.
 */
export async function listEmployees(options?: {
  includeDeactivated?: boolean;
}): Promise<HrEmployee[]> {
  const supabase = await hrUserClient();
  let query = supabase
    .from("hr_employees")
    .select(EMPLOYEE_COLUMNS)
    .order("first_name", { ascending: true });

  if (!options?.includeDeactivated) {
    query = query.neq("status", "deactivated");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[hr/employees] list failed:", error.message);
    return [];
  }
  return (data as unknown as EmployeeRow[]).map(toEmployee);
}

/**
 * One employee, or null.
 *
 * Gated explicitly rather than relying on RLS alone. RLS would return zero rows
 * for a forbidden id, which is indistinguishable from "no such employee" — the
 * caller needs 403 vs 404 to render something honest, and a silent empty result
 * is the kind of thing that gets papered over with a redirect.
 */
export async function getEmployee(employeeId: string): Promise<HrEmployee | null> {
  await requireCanViewEmployee(employeeId);
  const supabase = await hrUserClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", employeeId)
    .maybeSingle();
  if (error) {
    console.error("[hr/employees] get failed:", error.message);
    return null;
  }
  return data ? toEmployee(data as unknown as EmployeeRow) : null;
}

/** The caller's own employee record. */
export async function getOwnEmployee(): Promise<HrEmployee | null> {
  const supabase = await hrUserClient();
  const { data: employeeId } = await supabase.rpc("hr_current_employee");
  if (!employeeId) return null;
  return getEmployee(employeeId as string);
}

/** People eligible to be named as someone's manager: Admins and Super Admins. */
export async function listPotentialManagers(): Promise<HrEmployee[]> {
  const all = await listEmployees();
  return all.filter(
    (e) => e.hrRole === "admin" || e.hrRole === "super_admin"
  );
}

export type CreateEmployeeInput = {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  department?: string | null;
  hrRole: HrRole;
  managerId?: string | null;
  employmentStartDate: DateOnly;
  locale?: HrLocale | null;
  /** Initial allowances. Written as entitlement rows, not employee columns. */
  annualAllowance?: number | null;
  sickAllowance?: number | null;
};

/**
 * Create an employee record. Super Admin only.
 *
 * The record exists before any login does — an invite is sent separately (see
 * `invites.ts`), and `hr_current_employee()` resolves the person by email until
 * they accept, so they are recognised the moment they first sign in.
 *
 * Initial allowances become `hr_employee_entitlements` rows for the current
 * leave year rather than columns on the employee, which is what lets a single
 * person's allowance differ (seniority, part-time, a negotiated contract)
 * without a schema change.
 */
export async function createEmployee(
  input: CreateEmployeeInput
): Promise<HrEmployee> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  const email = input.email.trim().toLowerCase();

  if (input.managerId) {
    await assertManagerIsValid(input.managerId, actor.orgId, null);
  }

  const { data, error } = await service
    .from("hr_employees")
    .insert({
      org_id: actor.orgId,
      email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      job_title: input.jobTitle?.trim() || null,
      department: input.department?.trim() || null,
      hr_role: input.hrRole,
      manager_id: input.managerId ?? null,
      employment_start_date: input.employmentStartDate,
      locale: input.locale ?? null,
      status: "invited",
    })
    .select(EMPLOYEE_COLUMNS)
    .single();

  if (error) {
    // 23505 is unique_violation — the org already has this email.
    if (error.code === "23505") {
      throw new HrAuthError(`An employee with ${email} already exists`, 403);
    }
    throw new Error(`[hr/employees] create failed: ${error.message}`);
  }

  const employee = toEmployee(data as unknown as EmployeeRow);
  await seedInitialEntitlements(employee, input, actor.orgId);
  await writeAudit(actor.employeeId, actor.orgId, "employee.created", "hr_employees", employee.id, null, {
    email,
    hr_role: input.hrRole,
    manager_id: input.managerId ?? null,
  });

  return employee;
}

/**
 * Write the starting allowance rows.
 *
 * Falls back to each leave type's `default_allowance` when the caller did not
 * specify, so a Super Admin creating someone with the standard entitlement does
 * not have to restate 12 and 3 every time.
 */
async function seedInitialEntitlements(
  employee: HrEmployee,
  input: CreateEmployeeInput,
  orgId: string
): Promise<void> {
  const service = hrServiceClient();
  const { data: types } = await service
    .from("hr_leave_types")
    .select("id, code, default_allowance")
    .eq("org_id", orgId)
    .eq("deducts_balance", true);

  if (!types?.length) return;

  const leaveYear = yearOf(employee.employmentStartDate);
  const overrides: Record<string, number | null | undefined> = {
    annual: input.annualAllowance,
    sick: input.sickAllowance,
  };

  const rows = (types as Array<{ id: string; code: string; default_allowance: number | null }>)
    .map((t) => {
      const allowance = overrides[t.code] ?? t.default_allowance;
      if (allowance == null) return null;
      return {
        org_id: orgId,
        employee_id: employee.id,
        leave_type_id: t.id,
        leave_year: leaveYear,
        allowance,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  const { error } = await service.from("hr_employee_entitlements").insert(rows);
  if (error) {
    console.error("[hr/employees] entitlement seed failed:", error.message);
  }
}

export type UpdateEmployeeInput = Partial<
  Omit<CreateEmployeeInput, "email" | "annualAllowance" | "sickAllowance">
>;

/** Update an employee's profile or role. Super Admin only. */
export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput
): Promise<HrEmployee> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  const before = await getEmployee(employeeId);
  if (!before) throw new HrAuthError("No such employee", 403);

  if (input.managerId) {
    await assertManagerIsValid(input.managerId, actor.orgId, employeeId);
  }

  const patch: Record<string, unknown> = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
  if (input.lastName !== undefined) patch.last_name = input.lastName.trim();
  if (input.jobTitle !== undefined) patch.job_title = input.jobTitle?.trim() || null;
  if (input.department !== undefined) patch.department = input.department?.trim() || null;
  if (input.hrRole !== undefined) patch.hr_role = input.hrRole;
  if (input.managerId !== undefined) patch.manager_id = input.managerId;
  if (input.employmentStartDate !== undefined)
    patch.employment_start_date = input.employmentStartDate;
  if (input.locale !== undefined) patch.locale = input.locale;

  if (Object.keys(patch).length === 0) return before;

  const { data, error } = await service
    .from("hr_employees")
    .update(patch)
    .eq("id", employeeId)
    .eq("org_id", actor.orgId)
    .select(EMPLOYEE_COLUMNS)
    .single();

  if (error) throw new Error(`[hr/employees] update failed: ${error.message}`);

  const after = toEmployee(data as unknown as EmployeeRow);

  // A role change is the one edit worth its own audit action — it is what the
  // requirement asks to be notified about, and what an auditor looks for.
  const action =
    input.hrRole !== undefined && input.hrRole !== before.hrRole
      ? "employee.role_changed"
      : "employee.updated";

  await writeAudit(actor.employeeId, actor.orgId, action, "hr_employees", employeeId,
    { hr_role: before.hrRole, manager_id: before.managerId },
    { hr_role: after.hrRole, manager_id: after.managerId }
  );

  // Only a ROLE change is notified. Correcting a job title or department is
  // routine admin; changing what somebody can see and do in the system is not,
  // and both the person and every Super Admin should know it happened.
  if (action === "employee.role_changed") {
    const { notifyRoleChanged } = await import("./notifications");
    const actorEmployee = await getEmployee(actor.employeeId).catch(() => null);
    await notifyRoleChanged({
      orgId: actor.orgId,
      employeeId,
      before: before.hrRole,
      after: after.hrRole,
      actorName: actorEmployee ? displayName(actorEmployee) : "a Super Admin",
    });
  }

  return after;
}

/**
 * Deactivate an employee, and decline anything they had outstanding.
 *
 * Never a hard delete. The ledger's foreign keys refuse one anyway (an audit
 * trail must not vanish with its subject), but the intent matters more than the
 * constraint: an ex-employee's leave history is exactly what you need when a
 * question about their final pay comes up six months later.
 */
export async function deactivateEmployee(
  employeeId: string,
  options?: { endDate?: DateOnly }
): Promise<{ employee: HrEmployee; declinedRequests: number }> {
  const actor = await requireHrSuperAdmin();
  const service = hrServiceClient();

  const before = await getEmployee(employeeId);
  if (!before) throw new HrAuthError("No such employee", 403);

  if (employeeId === actor.employeeId) {
    throw new HrAuthError(
      "You cannot deactivate your own account — ask another Super Admin",
      403
    );
  }

  const { data: declined, error: declineError } = await service
    .from("hr_leave_requests")
    .update({
      status: "declined",
      decided_by: actor.employeeId,
      decided_at: new Date().toISOString(),
      decision_note: "Automatically declined: employee deactivated",
    })
    .eq("employee_id", employeeId)
    .eq("status", "pending")
    .select("id");

  if (declineError) {
    console.error("[hr/employees] auto-decline failed:", declineError.message);
  }

  const timezone = await orgTimezone(actor.orgId);
  const { data, error } = await service
    .from("hr_employees")
    .update({
      status: "deactivated",
      employment_end_date: options?.endDate ?? todayInTimeZone(timezone),
    })
    .eq("id", employeeId)
    .eq("org_id", actor.orgId)
    .select(EMPLOYEE_COLUMNS)
    .single();

  if (error) throw new Error(`[hr/employees] deactivate failed: ${error.message}`);

  const declinedCount = declined?.length ?? 0;
  await writeAudit(actor.employeeId, actor.orgId, "employee.deactivated", "hr_employees",
    employeeId, { status: before.status }, { status: "deactivated", declined_requests: declinedCount }
  );

  return { employee: toEmployee(data as unknown as EmployeeRow), declinedRequests: declinedCount };
}

/**
 * Reject a manager assignment that would be nonsense.
 *
 * Postgres already refuses self-management via a CHECK constraint, but a longer
 * cycle (A manages B manages A) cannot be expressed cheaply in SQL, so it is
 * caught here. Left unchecked it would make the org chart unrenderable and hang
 * any code that walks the reporting line.
 */
async function assertManagerIsValid(
  managerId: string,
  orgId: string,
  employeeId: string | null
): Promise<void> {
  if (employeeId && managerId === employeeId) {
    throw new HrAuthError("An employee cannot manage themselves", 403);
  }

  const service = hrServiceClient();
  const { data: manager } = await service
    .from("hr_employees")
    .select("id, org_id, hr_role, status")
    .eq("id", managerId)
    .maybeSingle();

  if (!manager) throw new HrAuthError("No such manager", 403);
  const m = manager as { org_id: string; hr_role: HrRole; status: HrEmployeeStatus };
  if (m.org_id !== orgId) {
    throw new HrAuthError("Manager belongs to a different organisation", 403);
  }
  if (m.status === "deactivated") {
    throw new HrAuthError("Cannot assign a deactivated employee as manager", 403);
  }
  if (m.hr_role === "staff") {
    throw new HrAuthError(
      "A Staff member cannot manage others — give them the Admin role first",
      403
    );
  }

  if (!employeeId) return;

  // Walk up the reporting line looking for the employee we are about to
  // reparent. The hop cap is a guard against a cycle that predates this check.
  let cursor: string | null = managerId;
  for (let hops = 0; cursor && hops < 50; hops++) {
    if (cursor === employeeId) {
      throw new HrAuthError(
        "That assignment would create a management cycle",
        403
      );
    }
    const result = await service
      .from("hr_employees")
      .select("manager_id")
      .eq("id", cursor)
      .maybeSingle();
    const parent = result.data as unknown as { manager_id: string | null } | null;
    cursor = parent?.manager_id ?? null;
  }
}

async function orgTimezone(orgId: string): Promise<string> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_organisations")
    .select("timezone")
    .eq("id", orgId)
    .maybeSingle();
  return (data as { timezone: string } | null)?.timezone ?? "Asia/Ho_Chi_Minh";
}

/**
 * Record a non-balance event.
 *
 * Balance movements are audited by the ledger itself; this covers the rest —
 * role changes, deactivation, invites. Best-effort on purpose: a failed audit
 * write is logged loudly but must not roll back the action it describes, or a
 * transient database hiccup would block a Super Admin from doing their job.
 */
export async function writeAudit(
  actorEmployeeId: string | null,
  orgId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown
): Promise<void> {
  const service = hrServiceClient();
  const { error } = await service.from("hr_audit_log").insert({
    org_id: orgId,
    actor_employee_id: actorEmployeeId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before: before ?? null,
    after: after ?? null,
  });
  if (error) {
    console.error(`[hr/audit] failed to record ${action}:`, error.message);
  }
}
