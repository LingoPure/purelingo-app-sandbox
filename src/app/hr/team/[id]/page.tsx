import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHrIdentity, HrAuthError } from "@/lib/hr/auth";
import { getEmployee, listPotentialManagers, displayName } from "@/lib/hr/employees";
import { getHrI18n } from "@/lib/hr/i18n";
import { getBalances, getAdjustmentHistory } from "@/lib/hr/balances";
import { listLeaveTypes, getOrgPolicy, getOrgTimezone } from "@/lib/hr/policy";
import { todayInTimeZone, leaveYearOf } from "@/lib/hr/dates";
import { PageHeader, Panel, PanelHeader, StatusPill, RolePill } from "../../ui";
import { EditMemberPanel, ResendInvitePanel, DeactivatePanel } from "./member-admin";
import { AdjustBalancePanel } from "./balance-panel";

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
  const [managers, headerList, { t, locale }] = await Promise.all([
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

  // Balances are readable by anyone who may view the employee — a Manager can
  // see a report's remaining days. Only a Super Admin gets the adjust panel.
  const [leaveTypes, policy, timezone] = await Promise.all([
    listLeaveTypes(identity.orgId),
    getOrgPolicy(identity.orgId),
    getOrgTimezone(identity.orgId),
  ]);
  const today = todayInTimeZone(timezone);
  const leaveYear = leaveYearOf(today, policy.leaveYearBasis, undefined);

  const [balances, adjustments] = await Promise.all([
    getBalances(employee.id, leaveYear, leaveTypes).catch(() => []),
    getAdjustmentHistory(employee.id, leaveYear).catch(() => []),
  ]);

  const localeName = (typeId: string) => {
    const type = leaveTypes.find((t) => t.id === typeId);
    return (locale === "vi" ? type?.nameVi : type?.nameEn) ?? "";
  };
  const deducting = balances.filter((b) => b.deductsBalance);

  const balanceLabels = {
    panelTitle: t("balance.panelTitle"),
    panelIntro: t("balance.panelIntro"),
    remaining: t("balance.remaining"),
    allowance: t("balance.allowance"),
    taken: t("balance.taken"),
    adjustTitle: t("balance.adjustTitle"),
    adjustIntro: t("balance.adjustIntro"),
    leaveType: t("balance.leaveType"),
    action: t("balance.action"),
    actionAdd: t("balance.actionAdd"),
    actionDeduct: t("balance.actionDeduct"),
    actionSet: t("balance.actionSet"),
    actionAllowance: t("balance.actionAllowance"),
    actionAddHint: t("balance.actionAddHint"),
    actionDeductHint: t("balance.actionDeductHint"),
    actionSetHint: t("balance.actionSetHint"),
    actionAllowanceHint: t("balance.actionAllowanceHint"),
    days: t("balance.days"),
    newAllowance: t("balance.newAllowance"),
    effectiveDate: t("balance.effectiveDate"),
    effectiveHint: t("balance.effectiveHint"),
    reason: t("balance.reason"),
    reasonHint: t("balance.reasonHint"),
    apply: t("balance.apply"),
    applying: t("balance.applying"),
    previewNoChange: t("balance.previewNoChange"),
    previewBalance: t("balance.previewBalance"),
    previewAllowance: t("balance.previewAllowance"),
    previewAllowanceNote: t("balance.previewAllowanceNote"),
  };

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

      {deducting.length > 0 ? (
        <Panel className="mb-6">
          <PanelHeader title={balanceLabels.panelTitle}>
            {balanceLabels.panelIntro}
          </PanelHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {deducting.map((balance) => (
              <div key={balance.leaveTypeId} className="rounded-md bg-mist/60 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-mute">
                  {localeName(balance.leaveTypeId) || balance.leaveTypeName}
                </p>
                <p className="mt-1 font-serif text-2xl text-navy">
                  {balance.remaining}
                  <span className="ml-1 text-sm text-mute">{balanceLabels.remaining}</span>
                </p>
                <p className="mt-1 text-xs text-mute">
                  {balanceLabels.allowance}: {balance.allowance ?? t("common.none")} ·{" "}
                  {balanceLabels.taken}: {balance.taken}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {isSuperAdmin && deducting.length > 0 ? (
        <AdjustBalancePanel
          employeeId={employee.id}
          leaveYear={leaveYear}
          today={today}
          balances={deducting.map((b) => ({
            leaveTypeId: b.leaveTypeId,
            name: localeName(b.leaveTypeId) || b.leaveTypeName,
            remaining: b.remaining,
            allowance: b.allowance,
            taken: b.taken,
          }))}
          labels={balanceLabels}
        />
      ) : null}

      {/* History is readable by anyone who may view the employee. A Manager
          seeing why a report's balance moved is reasonable; changing it is not. */}
      <Panel className="mb-6">
        <PanelHeader title={t("balance.historyTitle")}>
          {t("balance.historyIntro")}
        </PanelHeader>
        {adjustments.length === 0 ? (
          <p className="text-sm text-mute">{t("balance.historyEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-cream">
            {adjustments.map((entry) => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-navy">
                    {entry.days > 0 ? "+" : ""}
                    {entry.days} {t("common.days")} ·{" "}
                    {localeName(entry.leaveTypeId)}
                  </span>
                  <span className="text-xs text-mute">
                    {t("balance.colDate")}: {entry.effectiveDate} ·{" "}
                    {t("balance.colAfter")}: {entry.balanceAfter}
                  </span>
                </div>
                {entry.reason ? (
                  <p className="mt-1 text-sm text-ink/80">{entry.reason}</p>
                ) : null}
                <p className="mt-1 text-xs text-mute">
                  {new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
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
