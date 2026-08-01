"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hrUserClient } from "@/lib/hr/deps";
import {
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  type CreateEmployeeInput,
} from "@/lib/hr/employees";
import { inviteEmployee } from "@/lib/hr/invites";
import { HrAuthError } from "@/lib/hr/auth";
import { isDateOnly } from "@/lib/hr/dates";
import type { HrRole, HrLocale } from "@/lib/hr/types";

/**
 * Server actions for the HR surfaces.
 *
 * Every one delegates authorisation to `src/lib/hr/*`, which gates before it
 * writes. Nothing here re-derives a permission rule — a second copy of a rule
 * becomes a different rule the first time one of them is edited.
 *
 * Actions return `{ error }` rather than throwing so a form can render the
 * message inline. An uncaught throw here becomes a full-page error boundary,
 * which loses everything the user typed.
 */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function toMessage(error: unknown): string {
  if (error instanceof HrAuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Sign out. A server action so the module needs no browser Supabase client. */
export async function hrSignOut(): Promise<void> {
  const supabase = await hrUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function requiredText(form: FormData, field: string, label: string): string {
  const value = String(form.get(field) ?? "").trim();
  if (!value) throw new HrAuthError(`${label} is required`, 403);
  return value;
}

function optionalText(form: FormData, field: string): string | null {
  const value = String(form.get(field) ?? "").trim();
  return value || null;
}

function optionalNumber(form: FormData, field: string, label: string): number | null {
  const raw = String(form.get(field) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new HrAuthError(`${label} must be a number of days, zero or more`, 403);
  }
  // Half days are the smallest unit anywhere in the system.
  if (Math.round(value * 2) !== value * 2) {
    throw new HrAuthError(`${label} must be in whole or half days`, 403);
  }
  return value;
}

function parseRole(form: FormData): HrRole {
  const value = String(form.get("hrRole") ?? "staff");
  if (value !== "super_admin" && value !== "admin" && value !== "staff") {
    throw new HrAuthError("Unrecognised role", 403);
  }
  return value;
}

function parseLocale(form: FormData): HrLocale | null {
  const value = String(form.get("locale") ?? "").trim();
  if (!value) return null;
  if (value !== "en" && value !== "vi") {
    throw new HrAuthError("Unrecognised language", 403);
  }
  return value;
}

export async function createEmployeeAction(form: FormData): Promise<ActionResult> {
  try {
    const startDate = requiredText(form, "employmentStartDate", "Employment start date");
    if (!isDateOnly(startDate)) {
      return { ok: false, error: "Employment start date must be a real date" };
    }

    const input: CreateEmployeeInput = {
      email: requiredText(form, "email", "Work email"),
      firstName: requiredText(form, "firstName", "First name"),
      lastName: requiredText(form, "lastName", "Last name"),
      jobTitle: optionalText(form, "jobTitle"),
      department: optionalText(form, "department"),
      hrRole: parseRole(form),
      managerId: optionalText(form, "managerId"),
      employmentStartDate: startDate,
      locale: parseLocale(form),
      annualAllowance: optionalNumber(form, "annualAllowance", "Annual leave allowance"),
      sickAllowance: optionalNumber(form, "sickAllowance", "Sick leave allowance"),
    };

    const employee = await createEmployee(input);
    revalidatePath("/hr/team");

    // Invite immediately, but do NOT fail the creation if mail bounces. The
    // record is the durable thing; an invite is resendable from the detail page.
    let note = "";
    try {
      const origin = String(form.get("origin") ?? "").trim();
      if (origin) {
        const invite = await inviteEmployee(employee.id, origin);
        note =
          invite.emailDelivery === "sent"
            ? " An invitation email has been sent."
            : ` The invitation email could not be sent (${invite.emailError ?? "unknown error"}) — open their profile to copy the link.`;
      }
    } catch (inviteError) {
      note = ` The invitation could not be sent (${toMessage(inviteError)}) — open their profile to retry.`;
    }

    return { ok: true, message: `${input.firstName} ${input.lastName} added.${note}` };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function updateEmployeeAction(form: FormData): Promise<ActionResult> {
  try {
    const employeeId = requiredText(form, "employeeId", "Employee");
    const startDate = String(form.get("employmentStartDate") ?? "").trim();
    if (startDate && !isDateOnly(startDate)) {
      return { ok: false, error: "Employment start date must be a real date" };
    }

    await updateEmployee(employeeId, {
      firstName: requiredText(form, "firstName", "First name"),
      lastName: requiredText(form, "lastName", "Last name"),
      jobTitle: optionalText(form, "jobTitle"),
      department: optionalText(form, "department"),
      hrRole: parseRole(form),
      managerId: optionalText(form, "managerId"),
      ...(startDate ? { employmentStartDate: startDate } : {}),
      locale: parseLocale(form),
    });

    revalidatePath("/hr/team");
    revalidatePath(`/hr/team/${employeeId}`);
    return { ok: true, message: "Saved." };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function deactivateEmployeeAction(form: FormData): Promise<ActionResult> {
  try {
    const employeeId = requiredText(form, "employeeId", "Employee");

    // Typing the email is the confirmation. A plain "are you sure" is clicked
    // through reflexively; retyping the address forces the operator to look at
    // WHICH person they are about to deactivate.
    const typed = String(form.get("confirmEmail") ?? "").trim().toLowerCase();
    const expected = String(form.get("expectedEmail") ?? "").trim().toLowerCase();
    if (!typed || typed !== expected) {
      return {
        ok: false,
        error: "Type the employee's work email exactly to confirm deactivation.",
      };
    }

    const result = await deactivateEmployee(employeeId);
    revalidatePath("/hr/team");
    revalidatePath(`/hr/team/${employeeId}`);

    const declined =
      result.declinedRequests > 0
        ? ` ${result.declinedRequests} pending leave request${result.declinedRequests === 1 ? "" : "s"} declined.`
        : "";
    return { ok: true, message: `Employee deactivated.${declined}` };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function resendInviteAction(form: FormData): Promise<ActionResult> {
  try {
    const employeeId = requiredText(form, "employeeId", "Employee");
    const origin = requiredText(form, "origin", "Origin");
    const invite = await inviteEmployee(employeeId, origin);
    revalidatePath(`/hr/team/${employeeId}`);

    return invite.emailDelivery === "sent"
      ? { ok: true, message: "Invitation resent." }
      : {
          ok: false,
          error: `Could not send the email (${invite.emailError ?? "unknown error"}). Link: ${invite.actionLink}`,
        };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/**
 * Change your own password.
 *
 * Goes through the USER-scoped client, so Supabase applies the change to the
 * caller's own session and nobody else's. Deliberately not routed through the
 * service client and an employee id: a "change password" that takes a target
 * id is one missing gate away from letting anyone reset anyone.
 */
export async function updateOwnPasswordAction(form: FormData): Promise<ActionResult> {
  try {
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    if (password.length < 10) {
      return { ok: false, error: "Use at least 10 characters." };
    }
    if (password !== confirm) {
      return { ok: false, error: "The two passwords do not match." };
    }

    const supabase = await hrUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "You are not signed in." };

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };

    return { ok: true, message: "Password updated." };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** Change your OWN display language. Not gated on role — it is your setting. */
export async function updateOwnLocaleAction(form: FormData): Promise<ActionResult> {
  try {
    const locale = parseLocale(form);
    const supabase = await hrUserClient();
    const { data: employeeId } = await supabase.rpc("hr_current_employee");
    if (!employeeId) return { ok: false, error: "You are not an HR employee." };

    // Goes through the service client via updateEmployee? No: that is Super
    // Admin gated. This is the one field a person may change about themselves,
    // so it is written directly, scoped to their own row.
    const { hrServiceClient } = await import("@/lib/hr/deps");
    const { error } = await hrServiceClient()
      .from("hr_employees")
      .update({ locale })
      .eq("id", employeeId as string);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/hr/settings");
    return { ok: true, message: "Language updated." };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}
