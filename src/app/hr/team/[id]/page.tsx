import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHrIdentity, HrAuthError } from "@/lib/hr/auth";
import { getEmployee, listPotentialManagers, displayName } from "@/lib/hr/employees";
import { getHrI18n } from "@/lib/hr/i18n";
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
  const [managers, headerList, { t }] = await Promise.all([
    isSuperAdmin ? listPotentialManagers() : Promise.resolve([]),
    headers(),
    getHrI18n(),
  ]);

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const manager = employee.managerId
    ? (await listPotentialManagers().catch(() => [])).find((m) => m.id === employee.managerId)
    : null;

  // Resolved here because the panels below are client components and cannot
  // reach the translator — see src/lib/hr/i18n for why locale resolution is a
  // server-side database read.
  const adminLabels = {
    editTitle: t("teamForm.editTitle"),
    editIntro: t("teamForm.editIntro"),
    firstName: t("teamForm.firstName"),
    lastName: t("teamForm.lastName"),
    jobTitle: t("settings.jobTitle"),
    department: t("settings.department"),
    role: t("settings.role"),
    roleStaff: t("role.staff"),
    roleAdmin: t("role.admin"),
    roleSuperAdmin: t("role.super_admin"),
    reportsTo: t("teamForm.reportsTo"),
    reportsToHintShort: t("teamForm.reportsToHintShort"),
    noManager: t("teamForm.noManager"),
    startDate: t("teamForm.startDate"),
    language: t("team.language"),
    companyDefault: t("common.companyDefault"),
    saveChanges: t("teamForm.saveChanges"),
    saving: t("common.saving"),
    inviteTitle: t("teamForm.inviteTitle"),
    inviteAccepted: t("teamForm.inviteAccepted"),
    invitePending: t("teamForm.invitePending"),
    resend: t("teamForm.resend"),
    resending: t("teamForm.resending"),
    deactivateTitle: t("teamForm.deactivateTitle"),
    deactivateIntro: t("teamForm.deactivateIntro"),
    deactivateStart: t("teamForm.deactivateStart"),
    deactivateConfirmLabel: t("teamForm.deactivateConfirmLabel"),
    deactivateConfirmHint: t("teamForm.deactivateConfirmHint"),
    deactivateButton: t("teamForm.deactivateButton"),
    deactivating: t("teamForm.deactivating"),
    cancel: t("common.cancel"),
  };

  return (
    <>
      <PageHeader title={displayName(employee)}>
        {isSuperAdmin ? t("team.detailIntroAdmin") : t("team.detailIntroReadOnly")}
      </PageHeader>

      <p className="mb-6">
        <Link href="/hr/team" className="text-sm text-navy underline underline-offset-4">
          ← {t("team.backToList")}
        </Link>
      </p>

      <Panel className="mb-6">
        <PanelHeader title={t("team.detailsTitle")} />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label={t("settings.workEmail")}>
            <span className="break-all">{employee.email}</span>
          </Detail>
          <Detail label={t("settings.status")}><StatusPill status={employee.status} t={t} /></Detail>
          <Detail label={t("settings.role")}><RolePill role={employee.hrRole} t={t} /></Detail>
          <Detail label={t("team.colReportsTo")}>
            {manager ? displayName(manager) : t("team.noManager")}
          </Detail>
          <Detail label={t("settings.jobTitle")}>{employee.jobTitle ?? t("common.none")}</Detail>
          <Detail label={t("settings.department")}>{employee.department ?? t("common.none")}</Detail>
          <Detail label={t("team.employmentStart")}>{employee.employmentStartDate}</Detail>
          <Detail label={t("team.language")}>
            {employee.locale === "vi"
              ? "Tiếng Việt"
              : employee.locale === "en"
                ? "English"
                : t("common.companyDefault")}
          </Detail>
        </dl>
      </Panel>

      {isSuperAdmin ? (
        <>
          <EditMemberPanel employee={employee} managers={managers} labels={adminLabels} />
          {employee.status !== "deactivated" ? (
            <>
              <ResendInvitePanel employee={employee} origin={origin} labels={adminLabels} />
              <DeactivatePanel employee={employee} labels={adminLabels} />
            </>
          ) : (
            <Panel>
              <PanelHeader title={t("team.deactivatedPanelTitle")}>
                {t("team.deactivatedPanelBody")}
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
