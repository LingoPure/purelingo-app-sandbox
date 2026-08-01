/**
 * Shared types for the HR module. Mirrors the schema in
 * supabase/migrations/0027_hr_01_foundation.sql.
 *
 * Kept hand-written rather than generated so the module carries no dependency
 * on this repo's Supabase codegen setup — the destination repo may not have one.
 */

import type { DateOnly, IsoDayOfWeek } from "./dates";

export type HrRole = "super_admin" | "admin" | "staff";
export type HrEmployeeStatus = "invited" | "active" | "deactivated";
export type HrLocale = "en" | "vi";
export type HrHalfDay = "am" | "pm";
export type HrRequestStatus = "pending" | "approved" | "declined" | "cancelled";

/**
 * Ledger entry kinds. The sign convention is fixed and enforced by convention
 * in `balances.ts` (issue #6), not by the database, because `manual_adjustment`
 * legitimately goes either way.
 *
 *   grants   → opening_balance, carry_over, accrual, request_cancelled
 *   consumes → request_approved, expiry
 *   either   → manual_adjustment
 */
export type HrLedgerEntryType =
  | "opening_balance"
  | "accrual"
  | "carry_over"
  | "expiry"
  | "request_approved"
  | "request_cancelled"
  | "manual_adjustment";

/** The four seeded leave types. Not exhaustive — the Super Admin may add more. */
export type HrLeaveTypeCode = "annual" | "sick" | "unpaid" | "public_holiday";

export type HrOrganisation = {
  id: string;
  name: string;
  legalEntity: string | null;
  registrationNumber: string | null;
  country: string;
  timezone: string;
};

/**
 * The leave rules, as data.
 *
 * Every field here answers a question in docs/HR_MODULE_QUESTIONS_FOR_THAO.md
 * and ships with that document's recommended default. All values are
 * PROVISIONAL until the client confirms; changing one is an UPDATE, not a code
 * change. That is the whole reason this shape exists.
 */
export type HrOrgPolicy = {
  orgId: string;
  /** A1/A2 — ISO day-of-week, 1=Mon … 7=Sun. */
  workingDays: IsoDayOfWeek[];
  saturdayHours: "none" | "half" | "full";
  countBasis: "working_days" | "calendar_days";
  /** A5 */
  dayStartTime: string;
  dayEndTime: string;
  /** B1 */
  accrualMode: "monthly" | "annual_grant";
  /** B2 */
  leaveYearBasis: "calendar" | "anniversary";
  /** B3 */
  carryOverMaxDays: number;
  carryOverExpiryMonth: number | null;
  /** B4 */
  prorateFirstYear: boolean;
  /** C1 */
  overBalancePolicy: "block" | "allow_negative" | "spill_to_unpaid";
  /** C4 */
  minNoticeDays: number;
  /** D1/D2 */
  approverEscalation: "super_admin" | "peer_super_admin" | "self_approve_logged";
  /** D4 */
  selfCancelFuture: boolean;
  selfCancelPast: boolean;
  /** E3 */
  holidayNoticeDays: number;
  /** F2 */
  defaultLocale: HrLocale;
};

export type HrEmployee = {
  id: string;
  orgId: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  hrRole: HrRole;
  managerId: string | null;
  employmentStartDate: DateOnly;
  employmentEndDate: DateOnly | null;
  status: HrEmployeeStatus;
  locale: HrLocale | null;
  invitedAt: string | null;
  inviteAcceptedAt: string | null;
};

export type HrLeaveType = {
  id: string;
  orgId: string;
  code: string;
  nameEn: string;
  nameVi: string;
  /** false for unpaid and public_holiday — the structural reason they never deduct. */
  deductsBalance: boolean;
  defaultAllowance: number | null;
  requiresApproval: boolean;
  active: boolean;
  sortOrder: number;
};

export type HrEntitlement = {
  id: string;
  orgId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  allowance: number;
};

export type HrLeaveRequest = {
  id: string;
  orgId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: DateOnly;
  endDate: DateOnly;
  startHalf: HrHalfDay | null;
  endHalf: HrHalfDay | null;
  /** Computed at submit and FROZEN. Never recalculated on read. */
  requestedDays: number;
  reason: string | null;
  status: HrRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

/** One balance event. A balance is the sum of `days` over these. */
export type HrLedgerEntry = {
  id: string;
  orgId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  entryType: HrLedgerEntryType;
  /** Signed. Positive grants, negative consumes. */
  days: number;
  requestId: string | null;
  effectiveDate: DateOnly;
  /** Mandatory for manual_adjustment; enforced by a CHECK constraint. */
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type HrPublicHoliday = {
  id: string;
  orgId: string;
  date: DateOnly;
  nameEn: string;
  nameVi: string;
  isRecurring: boolean;
  notifiedAt: string | null;
};

/** The `làm bù` override: a weekend day designated as worked, or vice versa. */
export type HrWorkingDayOverride = {
  id: string;
  orgId: string;
  date: DateOnly;
  isWorkingDay: boolean;
  note: string | null;
};

/** The signed-in user's HR identity, resolved server-side. */
export type HrIdentity = {
  employeeId: string;
  orgId: string;
  role: HrRole;
};
