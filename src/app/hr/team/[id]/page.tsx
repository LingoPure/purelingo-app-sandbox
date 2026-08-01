import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHrIdentity, HrAuthError } from "@/lib/hr/auth";
import { getEmployee, listPotentialManagers, displayName } from "@/lib/hr/employees";
import { PageHeader, Panel, PanelHeader, StatusPill, RolePill } from "../../ui";
import { EditMemberPanel, ResendInvitePanel, DeactivatePanel } from "./member-admin";

export const metadata = { title: "Team member · LingoPure People" };

/**
 * One person's record.
 *
 * Readable by anyone `hr_can_view_employee` permits — their manager and a Super
 * Admin — but only a Super Admin gets the editing panels. A Manager seeing a
 * report's details is normal; a Manager changing their role is not.
 *
 * A forbidden id produces 404, not 403. Distinguishing "you may not see this"
 * from "this does not exist" tells an unauthorised caller that a given employee
 * id is real, which is more than they should learn from a URL.
 */
export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/team");

  const { id } = await params;

  let employee;
  try {
    employee = await getEmployee(id);
  } catch (error) {
    if (error instanceof HrAuthError) notFound();
    throw error;
  }
  if (!employee) notFound();

  const isSuperAdmin = identity.role === "super_admin";
  const [managers, headerList] = await Promise.all([
    isSuperAdmin ? listPotentialManagers() : Promise.resolve([]),
    headers(),
  ]);

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const manager = employee.managerId
    ? (await listPotentialManagers().catch(() => [])).find((m) => m.id === employee.managerId)
    : null;

  return (
    <>
      <PageHeader title={displayName(employee)}>
        {isSuperAdmin
          ? "Their profile, role and reporting line. Changes here affect who approves their leave and what they can see."
          : "Their profile and reporting line. Only a Super Admin can change these details."}
      </PageHeader>

      <p className="mb-6">
        <Link href="/hr/team" className="text-sm text-navy underline underline-offset-4">
          ← Back to team members
        </Link>
      </p>

      <Panel className="mb-6">
        <PanelHeader title="Details" />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Work email">
            <span className="break-all">{employee.email}</span>
          </Detail>
          <Detail label="Status"><StatusPill status={employee.status} /></Detail>
          <Detail label="Role"><RolePill role={employee.hrRole} /></Detail>
          <Detail label="Reports to">
            {manager ? displayName(manager) : "No manager assigned"}
          </Detail>
          <Detail label="Job title">{employee.jobTitle ?? "—"}</Detail>
          <Detail label="Department">{employee.department ?? "—"}</Detail>
          <Detail label="Employment start">{employee.employmentStartDate}</Detail>
          <Detail label="Language">
            {employee.locale === "vi"
              ? "Tiếng Việt"
              : employee.locale === "en"
                ? "English"
                : "Company default"}
          </Detail>
        </dl>
      </Panel>

      {isSuperAdmin ? (
        <>
          <EditMemberPanel employee={employee} managers={managers} />
          {employee.status !== "deactivated" ? (
            <>
              <ResendInvitePanel employee={employee} origin={origin} />
              <DeactivatePanel employee={employee} />
            </>
          ) : (
            <Panel>
              <PanelHeader title="Deactivated">
                This person cannot sign in. Their leave history is retained. To
                restore access, save their profile above with an active role and
                resend an invitation.
              </PanelHeader>
            </Panel>
          )}
        </>
      ) : null}
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-mute">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}
