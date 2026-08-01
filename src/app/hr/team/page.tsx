import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listEmployees, listPotentialManagers } from "@/lib/hr/employees";
import { todayInTimeZone } from "@/lib/hr/dates";
import { getHrI18n, type HrTranslate } from "@/lib/hr/i18n";
import { PageHeader, StatusPill, RolePill, EmptyState } from "../ui";
import { AddMemberForm } from "./add-member-form";

export const metadata = { title: "Team members · LingoPure People" };

/**
 * The Super Admin roster.
 *
 * Gated twice on purpose. RLS already limits what rows come back, but a Manager
 * or Staff member landing here would see a page framed as company-wide
 * administration showing only themselves, which reads as a bug. The redirect
 * sends them somewhere that makes sense instead.
 */
export default async function TeamPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/team");
  if (identity.role !== "super_admin") redirect("/hr");

  const [employees, managers, headerList, { t }] = await Promise.all([
    listEmployees({ includeDeactivated: true }),
    listPotentialManagers(),
    headers(),
    getHrI18n(),
  ]);

  // Absolute origin for invitation links. Behind a proxy the forwarded headers
  // are the only honest source; host alone would mint links pointing at an
  // internal address that nobody outside can reach.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const byId = new Map(employees.map((e) => [e.id, e]));
  const active = employees.filter((e) => e.status !== "deactivated");
  const deactivated = employees.filter((e) => e.status === "deactivated");

  return (
    <>
      <PageHeader title={t("team.title")}>{t("team.intro")}</PageHeader>

      <AddMemberForm
        managers={managers}
        origin={origin}
        defaultStartDate={todayInTimeZone("Asia/Ho_Chi_Minh")}
        labels={{
          addButton: t("teamForm.addButton"),
          addTitle: t("teamForm.addTitle"),
          addIntro: t("teamForm.addIntro"),
          firstName: t("teamForm.firstName"),
          lastName: t("teamForm.lastName"),
          workEmail: t("teamForm.workEmail"),
          workEmailHint: t("teamForm.workEmailHint"),
          jobTitle: t("settings.jobTitle"),
          department: t("settings.department"),
          role: t("settings.role"),
          roleHint: t("teamForm.roleHint"),
          roleStaff: t("role.staff"),
          roleAdmin: t("role.admin"),
          roleSuperAdmin: t("role.super_admin"),
          reportsTo: t("teamForm.reportsTo"),
          reportsToHint: t("teamForm.reportsToHint"),
          noManager: t("teamForm.noManager"),
          startDate: t("teamForm.startDate"),
          annualDays: t("teamForm.annualDays"),
          annualHint: t("teamForm.annualHint"),
          sickDays: t("teamForm.sickDays"),
          sickHint: t("teamForm.sickHint"),
          language: t("team.language"),
          languageHint: t("teamForm.languageHint"),
          companyDefault: t("common.companyDefault"),
          submit: t("teamForm.submit"),
          submitting: t("teamForm.submitting"),
          cancel: t("common.cancel"),
        }}
      />

      {active.length === 0 ? (
        <EmptyState title={t("team.emptyTitle")}>{t("team.emptyBody")}</EmptyState>
      ) : (
        <TeamTable employees={active} byId={byId} t={t} />
      )}

      {deactivated.length > 0 ? (
        <div className="mt-10">
          <h2 className="mb-3 font-serif text-lg text-navy">{t("team.deactivatedTitle")}</h2>
          <p className="mb-4 max-w-prose text-sm text-mute">{t("team.deactivatedIntro")}</p>
          <TeamTable employees={deactivated} byId={byId} t={t} />
        </div>
      ) : null}
    </>
  );
}

/**
 * Roster table.
 *
 * Two renderings of one dataset: stacked cards up to `md`, a real table above
 * it. A table forced through a phone viewport either overflows off-screen or
 * shrinks the text below readable size, and neither is acceptable for the view
 * an operator uses most.
 */
function TeamTable({
  employees,
  byId,
  t,
}: {
  employees: Awaited<ReturnType<typeof listEmployees>>;
  byId: Map<string, Awaited<ReturnType<typeof listEmployees>>[number]>;
  t: HrTranslate;
}) {
  const managerName = (managerId: string | null) => {
    if (!managerId) return "—";
    const m = byId.get(managerId);
    return m ? `${m.firstName} ${m.lastName}` : t("common.none");
  };

  return (
    <>
      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {employees.map((e) => (
          <li key={e.id} className="rounded-lg border border-cream bg-paper p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/hr/team/${e.id}`}
                className="font-medium text-navy underline-offset-4 hover:underline"
              >
                {e.firstName} {e.lastName}
              </Link>
              <StatusPill status={e.status} t={t} />
            </div>
            <p className="mt-1 break-all text-sm text-mute">{e.email}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("team.colRole")}</dt>
                <dd className="mt-1"><RolePill role={e.hrRole} t={t} /></dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("team.colReportsTo")}</dt>
                <dd className="mt-1 text-ink">{managerName(e.managerId)}</dd>
              </div>
              {e.jobTitle ? (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-mute">{t("settings.jobTitle")}</dt>
                  <dd className="mt-1 text-ink">{e.jobTitle}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-cream bg-paper md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream bg-mist/60">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium text-navy">{t("team.colName")}</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">{t("team.colRole")}</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">{t("team.colReportsTo")}</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">{t("team.colDepartment")}</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">{t("team.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-cream last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/hr/team/${e.id}`}
                    className="font-medium text-navy underline-offset-4 hover:underline"
                  >
                    {e.firstName} {e.lastName}
                  </Link>
                  <div className="text-xs text-mute">{e.email}</div>
                </td>
                <td className="px-4 py-3"><RolePill role={e.hrRole} t={t} /></td>
                <td className="px-4 py-3 text-ink">{managerName(e.managerId)}</td>
                <td className="px-4 py-3 text-ink">{e.department ?? t("common.none")}</td>
                <td className="px-4 py-3"><StatusPill status={e.status} t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
