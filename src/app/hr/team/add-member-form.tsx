"use client";

import { useActionState, useState } from "react";
import { createEmployeeAction, type ActionResult } from "../actions";
import {
  Field,
  Panel,
  PanelHeader,
  inputClass,
  buttonPrimaryClass,
  buttonQuietClass,
} from "../ui";
import type { HrEmployee } from "@/lib/hr/types";

/**
 * Add-a-team-member form.
 *
 * Collapsed by default. The list is what a Super Admin comes here to read; an
 * always-open ten-field form pushes it below the fold and makes the common case
 * pay for the rare one.
 */
export function AddMemberForm({
  managers,
  origin,
  defaultStartDate,
}: {
  managers: HrEmployee[];
  origin: string;
  defaultStartDate: string;
}) {
  const [open, setOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => {
      const result = await createEmployeeAction(form);
      if (result.ok) setOpen(false);
      return result;
    },
    null
  );

  if (!open) {
    return (
      <div className="mb-6">
        <button type="button" onClick={() => setOpen(true)} className={buttonPrimaryClass}>
          Add a team member
        </button>
        {state?.ok && state.message ? (
          <p className="mt-3 rounded-md bg-ai-green/10 px-4 py-3 text-sm text-ai-green">
            {state.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Panel className="mb-6">
      <PanelHeader title="Add a team member">
        Creates their record and emails an invitation. They can sign in as soon
        as they accept; their leave balance starts from the allowances below.
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="origin" value={origin} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="First name" required>
            <input id="firstName" name="firstName" required className={inputClass} autoComplete="given-name" />
          </Field>
          <Field id="lastName" label="Last name" required>
            <input id="lastName" name="lastName" required className={inputClass} autoComplete="family-name" />
          </Field>
        </div>

        <Field id="email" label="Work email" required hint="The invitation goes here, and it is how they sign in.">
          <input id="email" name="email" type="email" required className={inputClass} autoComplete="off" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="jobTitle" label="Job title">
            <input id="jobTitle" name="jobTitle" className={inputClass} />
          </Field>
          <Field id="department" label="Department">
            <input id="department" name="department" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="hrRole"
            label="Role"
            required
            hint="Staff request leave. Managers approve for their own team. Super Admins manage everyone."
          >
            <select id="hrRole" name="hrRole" required defaultValue="staff" className={inputClass}>
              <option value="staff">Staff</option>
              <option value="admin">Manager</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </Field>

          <Field
            id="managerId"
            label="Reports to"
            hint="Their manager approves their leave. Leave blank to route approvals to a Super Admin."
          >
            <select id="managerId" name="managerId" defaultValue="" className={inputClass}>
              <option value="">No manager assigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="employmentStartDate" label="Employment start date" required>
            <input
              id="employmentStartDate"
              name="employmentStartDate"
              type="date"
              required
              defaultValue={defaultStartDate}
              className={inputClass}
            />
          </Field>
          <Field id="annualAllowance" label="Annual leave (days)" hint="Defaults to 12.">
            <input
              id="annualAllowance"
              name="annualAllowance"
              type="number"
              min="0"
              step="0.5"
              placeholder="12"
              className={inputClass}
            />
          </Field>
          <Field id="sickAllowance" label="Sick leave (days)" hint="Defaults to 3.">
            <input
              id="sickAllowance"
              name="sickAllowance"
              type="number"
              min="0"
              step="0.5"
              placeholder="3"
              className={inputClass}
            />
          </Field>
        </div>

        <Field id="locale" label="Language" hint="Used for the interface and their notification emails.">
          <select id="locale" name="locale" defaultValue="" className={inputClass}>
            <option value="">Use the company default</option>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>

        {state && !state.ok ? (
          <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? "Adding…" : "Add and send invitation"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={buttonQuietClass}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}
