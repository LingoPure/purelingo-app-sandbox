"use client";

import { useActionState, useState } from "react";
import {
  updateEmployeeAction,
  deactivateEmployeeAction,
  resendInviteAction,
  type ActionResult,
} from "../../actions";
import {
  Field,
  Panel,
  PanelHeader,
  inputClass,
  buttonPrimaryClass,
  buttonQuietClass,
  buttonDangerClass,
} from "../../ui";
import type { HrEmployee } from "@/lib/hr/types";

/** Pre-translated strings from the server page. See settings-forms for why. */
export type MemberAdminLabels = Record<string, string>;

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-md bg-ai-green/10 px-4 py-3 text-sm text-ai-green">
      {state.message ?? "Saved."}
    </p>
  ) : (
    <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm break-words text-coral">
      {state.error}
    </p>
  );
}

/** Edit profile, role and reporting line. Super Admin only. */
export function EditMemberPanel({
  employee,
  managers,
  labels,
}: {
  employee: HrEmployee;
  managers: HrEmployee[];
  labels: MemberAdminLabels;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => updateEmployeeAction(form),
    null
  );

  // A person cannot report to themselves; leaving the option in the list invites
  // a click that only fails after submission.
  const selectable = managers.filter((m) => m.id !== employee.id);

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.editTitle}>{labels.editIntro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="employeeId" value={employee.id} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label={labels.firstName} required>
            <input id="firstName" name="firstName" required defaultValue={employee.firstName} className={inputClass} />
          </Field>
          <Field id="lastName" label={labels.lastName} required>
            <input id="lastName" name="lastName" required defaultValue={employee.lastName} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="jobTitle" label={labels.jobTitle}>
            <input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle ?? ""} className={inputClass} />
          </Field>
          <Field id="department" label={labels.department}>
            <input id="department" name="department" defaultValue={employee.department ?? ""} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="hrRole" label={labels.role} required>
            <select id="hrRole" name="hrRole" required defaultValue={employee.hrRole} className={inputClass}>
              <option value="staff">{labels.roleStaff}</option>
              <option value="admin">{labels.roleAdmin}</option>
              <option value="super_admin">{labels.roleSuperAdmin}</option>
            </select>
          </Field>
          <Field id="managerId" label={labels.reportsTo} hint={labels.reportsToHintShort}>
            <select id="managerId" name="managerId" defaultValue={employee.managerId ?? ""} className={inputClass}>
              <option value="">{labels.noManager}</option>
              {selectable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="employmentStartDate" label={labels.startDate} required>
            <input
              id="employmentStartDate"
              name="employmentStartDate"
              type="date"
              required
              defaultValue={employee.employmentStartDate}
              className={inputClass}
            />
          </Field>
          <Field id="locale" label={labels.language}>
            <select id="locale" name="locale" defaultValue={employee.locale ?? ""} className={inputClass}>
              <option value="">{labels.companyDefault}</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? labels.saving : labels.saveChanges}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Resend the activation email, for someone who never accepted. */
export function ResendInvitePanel({
  employee,
  origin,
  labels,
}: {
  employee: HrEmployee;
  origin: string;
  labels: MemberAdminLabels;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => resendInviteAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.inviteTitle}>
        {employee.inviteAcceptedAt ? labels.inviteAccepted : labels.invitePending}
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="employeeId" value={employee.id} />
        <input type="hidden" name="origin" value={origin} />
        <Result state={state} />
        <div>
          <button type="submit" disabled={pending} className={`${buttonQuietClass} disabled:opacity-60`}>
            {pending ? labels.resending : labels.resend}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Deactivation.
 *
 * Confirmation is typing the work email, not a yes/no dialog. A confirm button
 * gets clicked reflexively; retyping the address forces the operator to look at
 * WHICH person they are about to remove. The consequences are stated before the
 * control, not after it.
 */
export function DeactivatePanel({
  employee,
  labels,
}: {
  employee: HrEmployee;
  labels: MemberAdminLabels;
}) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => deactivateEmployeeAction(form),
    null
  );

  return (
    <Panel className="border-coral/30">
      <PanelHeader title={labels.deactivateTitle}>{labels.deactivateIntro}</PanelHeader>

      {!armed ? (
        <button type="button" onClick={() => setArmed(true)} className={buttonQuietClass}>
          {labels.deactivateStart.replace("{name}", employee.firstName)}
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="employeeId" value={employee.id} />
          <input type="hidden" name="expectedEmail" value={employee.email} />

          <Field
            id="confirmEmail"
            label={labels.deactivateConfirmLabel.replace("{email}", employee.email)}
            required
            hint={labels.deactivateConfirmHint}
          >
            <input
              id="confirmEmail"
              name="confirmEmail"
              required
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Result state={state} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={pending} className={`${buttonDangerClass} disabled:opacity-60`}>
              {pending ? labels.deactivating : labels.deactivateButton}
            </button>
            <button type="button" onClick={() => setArmed(false)} className={buttonQuietClass}>
              {labels.cancel}
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}
