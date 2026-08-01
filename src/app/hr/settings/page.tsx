import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, displayName } from "@/lib/hr/employees";
import { PageHeader, Panel, PanelHeader, RolePill, StatusPill } from "../ui";
import { LanguageForm, PasswordForm } from "./settings-forms";

export const metadata = { title: "Settings · LingoPure People" };

/**
 * Your own account.
 *
 * Everyone reaches this, regardless of role. Profile details are read-only
 * here: name, job title, manager and role are HR records, not preferences, and
 * letting someone edit their own reporting line would quietly break who
 * approves their leave. Language and password are yours to change.
 */
export default async function HrSettingsPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/settings");

  const me = await getOwnEmployee();
  if (!me) redirect("/login?next=/hr/settings");

  return (
    <>
      <PageHeader title="Settings">
        Your account details, the language we use with you, and your password.
        Name, role and reporting line are managed by a Super Admin — ask them if
        something here is wrong.
      </PageHeader>

      <Panel className="mb-6">
        <PanelHeader title="Your details" />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Name</dt>
            <dd className="mt-1 text-ink">{displayName(me)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Work email</dt>
            <dd className="mt-1 break-all text-ink">{me.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Role</dt>
            <dd className="mt-1"><RolePill role={me.hrRole} /></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Status</dt>
            <dd className="mt-1"><StatusPill status={me.status} /></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Job title</dt>
            <dd className="mt-1 text-ink">{me.jobTitle ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Department</dt>
            <dd className="mt-1 text-ink">{me.department ?? "—"}</dd>
          </div>
        </dl>
      </Panel>

      <LanguageForm current={me.locale} />
      <PasswordForm />
    </>
  );
}
