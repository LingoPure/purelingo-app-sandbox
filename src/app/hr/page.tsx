import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, listEmployees, displayName } from "@/lib/hr/employees";
import { PageHeader, Panel, PanelHeader, RolePill } from "./ui";

export const metadata = { title: "People · LingoPure" };

/**
 * The HR landing page.
 *
 * Deliberately honest about what is not built yet. Leave requests, balances,
 * the team calendar and public holidays arrive with later issues; naming them
 * here — rather than silently omitting them — is what stops this page reading
 * as a broken dashboard. Every route named below either exists or is described
 * as not yet available. No link goes nowhere.
 */
export default async function HrHomePage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr");

  const me = await getOwnEmployee();
  const isSuperAdmin = identity.role === "super_admin";

  const teamCount = isSuperAdmin
    ? (await listEmployees()).length
    : null;

  return (
    <>
      <PageHeader title="People">
        Leave requests, balances and team management for LingoPure staff. This is
        the first release: accounts and roles work now, and leave requests
        arrive next.
      </PageHeader>

      <Panel className="mb-6">
        <PanelHeader title="Signed in as" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-medium text-navy">
            {me ? displayName(me) : "—"}
          </span>
          <RolePill role={identity.role} />
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-mute">
          {isSuperAdmin
            ? "As a Super Admin you can add colleagues, set their roles and decide who approves whose leave."
            : identity.role === "admin"
              ? "As a Manager you will approve leave for the people who report to you. Approvals arrive in the next release."
              : "As a member of staff you will be able to request leave and see your remaining balance. That arrives in the next release."}
        </p>
      </Panel>

      {isSuperAdmin ? (
        <Panel className="mb-6">
          <PanelHeader title="Team members">
            {teamCount === 0
              ? "Nobody has been added yet."
              : `${teamCount} ${teamCount === 1 ? "person" : "people"} with an account.`}
          </PanelHeader>
          <Link
            href="/hr/team"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-navy-deep"
          >
            {teamCount === 0 ? "Add your first colleague" : "Manage team members"}
          </Link>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Coming next">
          These are being built and are not available yet. Nothing you do now
          will need redoing when they arrive.
        </PanelHeader>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink/80">
          <li>Requesting leave, and seeing your remaining annual and sick days.</li>
          <li>Approving or declining leave for your team.</li>
          <li>A team calendar showing who is off, and upcoming public holidays.</li>
          <li>Email notifications when a request is submitted or decided.</li>
        </ul>
      </Panel>
    </>
  );
}
