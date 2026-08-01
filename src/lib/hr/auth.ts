/**
 * HR authorisation.
 *
 * The permission model lives in the DATABASE — `hr_can_view_employee()` and
 * `hr_can_approve_for()` in 0027_hr_01_foundation.sql. This file is the thin
 * server-side reader over it, plus the gates that API routes call before a
 * write.
 *
 * TWO RULES THAT MATTER:
 *
 * 1. Reads go through the USER-SCOPED client so RLS applies. This module does
 *    NOT copy the pattern in `src/lib/employer/auth.ts:41`, which reaches for
 *    the service-role client to sidestep an @supabase/ssr cookie-timing race.
 *    That trick bypasses RLS wholesale. It is survivable for a single-tenant
 *    demo gate; here, where "an Admin sees only their team" IS the product, it
 *    would quietly delete the entire permission model.
 *
 * 2. These helpers never re-derive the rules in TypeScript. They ask the
 *    database. Two copies of a permission rule become two different permission
 *    rules the first time one is edited.
 */

import { hrUserClient } from "./deps";
import type { HrIdentity, HrRole } from "./types";

/**
 * The signed-in user's HR identity, or null if they are not an employee.
 *
 * Resolves through `hr_current_employee()`, which matches on `auth_user_id`
 * first and falls back to email — so an invited employee who has not yet
 * accepted, and the seeded first Super Admin who has no auth row at all, are
 * both recognised on first sign-in.
 */
export async function getHrIdentity(): Promise<HrIdentity | null> {
  const supabase = await hrUserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: employeeId }, { data: role }, { data: orgId }] =
    await Promise.all([
      supabase.rpc("hr_current_employee"),
      supabase.rpc("hr_current_role"),
      supabase.rpc("hr_current_org"),
    ]);

  if (!employeeId || !role || !orgId) return null;

  return {
    employeeId: employeeId as string,
    orgId: orgId as string,
    role: role as HrRole,
  };
}

/** True when the current user may see the target employee's records. */
export async function canViewEmployee(targetEmployeeId: string): Promise<boolean> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase.rpc("hr_can_view_employee", {
    target_employee_id: targetEmployeeId,
  });
  if (error) {
    console.error("[hr/auth] hr_can_view_employee failed:", error.message);
    return false; // Fail closed. An unresolved permission is not permission.
  }
  return data === true;
}

/** True when the current user may approve or decline the target's leave. */
export async function canApproveFor(targetEmployeeId: string): Promise<boolean> {
  const supabase = await hrUserClient();
  const { data, error } = await supabase.rpc("hr_can_approve_for", {
    target_employee_id: targetEmployeeId,
  });
  if (error) {
    console.error("[hr/auth] hr_can_approve_for failed:", error.message);
    return false;
  }
  return data === true;
}

/**
 * Thrown by the `require*` gates below. API routes map it to a status code;
 * see `hrErrorStatus`.
 */
export class HrAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403
  ) {
    super(message);
    this.name = "HrAuthError";
  }
}

/** Maps any thrown value to an HTTP status, defaulting to 500. */
export function hrErrorStatus(error: unknown): number {
  return error instanceof HrAuthError ? error.status : 500;
}

/**
 * Gate: the caller must be an HR employee.
 *
 * 401 (not signed in, or signed in but not an employee) rather than 403,
 * deliberately: telling an arbitrary authenticated user that HR exists and
 * they merely lack permission is more than they need to know.
 */
export async function requireHrEmployee(): Promise<HrIdentity> {
  const identity = await getHrIdentity();
  if (!identity) throw new HrAuthError("Not an HR employee", 401);
  return identity;
}

/** Gate: the caller must hold one of the given roles. */
export async function requireHrRole(
  ...roles: HrRole[]
): Promise<HrIdentity> {
  const identity = await requireHrEmployee();
  if (!roles.includes(identity.role)) {
    throw new HrAuthError(
      `Requires role ${roles.join(" or ")}, caller is ${identity.role}`,
      403
    );
  }
  return identity;
}

/** Gate: Super Admin only. Employee management, policy, holidays, adjustments. */
export async function requireHrSuperAdmin(): Promise<HrIdentity> {
  return requireHrRole("super_admin");
}

/**
 * Gate: the caller may read this employee's records.
 *
 * Use on every route that takes an employee id from the request. Without it a
 * route reading through the service-role client would happily return anyone's
 * leave history to anyone who guessed a UUID.
 */
export async function requireCanViewEmployee(
  targetEmployeeId: string
): Promise<HrIdentity> {
  const identity = await requireHrEmployee();
  if (!(await canViewEmployee(targetEmployeeId))) {
    throw new HrAuthError("Not permitted to view this employee", 403);
  }
  return identity;
}

/** Gate: the caller may decide this employee's leave requests. */
export async function requireCanApproveFor(
  targetEmployeeId: string
): Promise<HrIdentity> {
  const identity = await requireHrEmployee();
  if (!(await canApproveFor(targetEmployeeId))) {
    throw new HrAuthError("Not permitted to approve for this employee", 403);
  }
  return identity;
}
