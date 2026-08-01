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
 * Strings arrive pre-translated. A client component cannot resolve a locale —
 * that means a database read — so the server page does it and passes plain data.
 */
export type AddMemberLabels = Record<string, string>;

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
  labels,
}: {
  managers: HrEmployee[];
  origin: string;
  defaultStartDate: string;
  labels: AddMemberLabels;
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
          {labels.addButton}
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
      <PanelHeader title={labels.addTitle}>{labels.addIntro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="origin" value={origin} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label={labels.firstName} required>
            <input id="firstName" name="firstName" required className={inputClass} autoComplete="given-name" />
          </Field>
          <Field id="lastName" label={labels.lastName} required>
            <input id="lastName" name="lastName" required className={inputClass} autoComplete="family-name" />
          </Field>
        </div>

        <Field id="email" label={labels.workEmail} required hint={labels.workEmailHint}>
          <input id="email" name="email" type="email" required className={inputClass} autoComplete="off" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="jobTitle" label={labels.jobTitle}>
            <input id="jobTitle" name="jobTitle" className={inputClass} />
          </Field>
          <Field id="department" label={labels.department}>
            <input id="department" name="department" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="hrRole"
            label={labels.role}
            required
            hint={labels.roleHint}
          >
            <select id="hrRole" name="hrRole" required defaultValue="staff" className={inputClass}>
              <option value="staff">{labels.roleStaff}</option>
              <option value="admin">{labels.roleAdmin}</option>
              <option value="super_admin">{labels.roleSuperAdmin}</option>
            </select>
          </Field>

          <Field
            id="managerId"
            label={labels.reportsTo}
            hint={labels.reportsToHint}
          >
            <select id="managerId" name="managerId" defaultValue="" className={inputClass}>
              <option value="">{labels.noManager}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="employmentStartDate" label={labels.startDate} required>
            <input
              id="employmentStartDate"
              name="employmentStartDate"
              type="date"
              required
              defaultValue={defaultStartDate}
              className={inputClass}
            />
          </Field>
          <Field id="annualAllowance" label={labels.annualDays} hint={labels.annualHint}>
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
          <Field id="sickAllowance" label={labels.sickDays} hint={labels.sickHint}>
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

        <Field id="locale" label={labels.language} hint={labels.languageHint}>
          <select id="locale" name="locale" defaultValue="" className={inputClass}>
            <option value="">{labels.companyDefault}</option>
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
            {pending ? labels.submitting : labels.submit}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={buttonQuietClass}>
            {labels.cancel}
          </button>
        </div>
      </form>
    </Panel>
  );
}
