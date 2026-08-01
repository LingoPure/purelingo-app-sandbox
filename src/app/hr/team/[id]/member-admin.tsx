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
}: {
  employee: HrEmployee;
  managers: HrEmployee[];
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
      <PanelHeader title="Profile and role">
        Changing someone&rsquo;s manager changes who approves their leave.
        Changing their role changes what they can see across the whole system.
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="employeeId" value={employee.id} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="First name" required>
            <input id="firstName" name="firstName" required defaultValue={employee.firstName} className={inputClass} />
          </Field>
          <Field id="lastName" label="Last name" required>
            <input id="lastName" name="lastName" required defaultValue={employee.lastName} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="jobTitle" label="Job title">
            <input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle ?? ""} className={inputClass} />
          </Field>
          <Field id="department" label="Department">
            <input id="department" name="department" defaultValue={employee.department ?? ""} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="hrRole" label="Role" required>
            <select id="hrRole" name="hrRole" required defaultValue={employee.hrRole} className={inputClass}>
              <option value="staff">Staff</option>
              <option value="admin">Manager</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </Field>
          <Field id="managerId" label="Reports to" hint="Their manager approves their leave requests.">
            <select id="managerId" name="managerId" defaultValue={employee.managerId ?? ""} className={inputClass}>
              <option value="">No manager assigned</option>
              {selectable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="employmentStartDate" label="Employment start date" required>
            <input
              id="employmentStartDate"
              name="employmentStartDate"
              type="date"
              required
              defaultValue={employee.employmentStartDate}
              className={inputClass}
            />
          </Field>
          <Field id="locale" label="Language">
            <select id="locale" name="locale" defaultValue={employee.locale ?? ""} className={inputClass}>
              <option value="">Use the company default</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? "Saving…" : "Save changes"}
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
}: {
  employee: HrEmployee;
  origin: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => resendInviteAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title="Invitation">
        {employee.inviteAcceptedAt
          ? "This person has activated their account."
          : "This person has not signed in yet. Resending issues a fresh link and invalidates the previous one."}
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="employeeId" value={employee.id} />
        <input type="hidden" name="origin" value={origin} />
        <Result state={state} />
        <div>
          <button type="submit" disabled={pending} className={`${buttonQuietClass} disabled:opacity-60`}>
            {pending ? "Sending…" : "Resend invitation"}
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
export function DeactivatePanel({ employee }: { employee: HrEmployee }) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => deactivateEmployeeAction(form),
    null
  );

  return (
    <Panel className="border-coral/30">
      <PanelHeader title="Deactivate this person">
        They lose access immediately and any leave request still waiting for a
        decision is declined. Their leave history and balances are kept, so past
        approvals stay auditable. This is not a deletion, and it can be undone by
        setting their role again.
      </PanelHeader>

      {!armed ? (
        <button type="button" onClick={() => setArmed(true)} className={buttonQuietClass}>
          Deactivate {employee.firstName}…
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="employeeId" value={employee.id} />
          <input type="hidden" name="expectedEmail" value={employee.email} />

          <Field
            id="confirmEmail"
            label={`Type ${employee.email} to confirm`}
            required
            hint="Typing the address confirms you are deactivating the right person."
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
              {pending ? "Deactivating…" : "Deactivate"}
            </button>
            <button type="button" onClick={() => setArmed(false)} className={buttonQuietClass}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}
