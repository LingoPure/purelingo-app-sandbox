import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, listEmployees, displayName } from "@/lib/hr/employees";
import { listLeaveTypes, getOrgTimezone, getOrgPolicy, listHolidays } from "@/lib/hr/policy";
import { getBalances } from "@/lib/hr/balances";
import { whoIsOff, listPendingApprovals, listRequests } from "@/lib/hr/requests";
import { todayInTimeZone, leaveYearOf, addDays } from "@/lib/hr/dates";
import { getHrI18n } from "@/lib/hr/i18n";
import {
  PageHeader,
  Panel,
  PanelHeader,
  RolePill,
  DateRange,
  RequestStatusPill,
  buttonPrimaryClass,
} from "./ui";

export const metadata = { title: "People · LingoPure" };

/**
 * The dashboard.
 *
 * Everything the requirement asks to be visible at a glance: remaining
 * balances, who is off today, upcoming public holidays, and — for anyone who
 * approves — what is waiting on them.
 *
 * Rendered per role rather than showing empty panels to people they do not
 * apply to. A Staff member has no approval queue, and a panel reading "0
 * pending" is noise on the page they use most.
 *
 * Leave type names come from the database in both languages, so they are picked
 * by locale here rather than translated — a Super Admin can add "Maternity
 * leave" and it has no dictionary key.
 */
export default async function HrHomePage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr");

  const [me, leaveTypes, timezone, policy, { t, locale }] = await Promise.all([
    getOwnEmployee(),
    listLeaveTypes(identity.orgId),
    getOrgTimezone(identity.orgId),
    getOrgPolicy(identity.orgId),
    getHrI18n(),
  ]);

  const today = todayInTimeZone(timezone);
  const leaveYear = leaveYearOf(today, policy.leaveYearBasis, undefined);
  const canApprove = identity.role !== "staff";

  const [balances, offToday, colleagues, upcomingHolidays, myRequests, pending] =
    await Promise.all([
      getBalances(identity.employeeId, leaveYear, leaveTypes),
      whoIsOff(today),
      listEmployees(),
      listHolidays(identity.orgId, today, addDays(today, 120)),
      listRequests({ employeeId: identity.employeeId, limit: 3 }),
      canApprove ? listPendingApprovals() : Promise.resolve([]),
    ]);

  const employeeById = new Map(colleagues.map((e) => [e.id, e]));
  const typeName = new Map(
    leaveTypes.map((type) => [type.id, locale === "vi" ? type.nameVi : type.nameEn])
  );
  const deducting = balances.filter((b) => b.deductsBalance);
  const nextHoliday = upcomingHolidays[0] ?? null;
  const holidayName = (h: (typeof upcomingHolidays)[number]) =>
    locale === "vi" ? h.nameVi : h.nameEn;

  return (
    <>
      <PageHeader
        title={me ? t("home.greeting", { name: me.firstName }) : t("nav.people")}
        action={
          <Link href="/hr/requests/new" className={buttonPrimaryClass}>
            {t("home.requestLeave")}
          </Link>
        }
      >
        {t("home.intro")}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {deducting.map((balance) => (
          <Panel key={balance.leaveTypeId}>
            <p className="text-xs uppercase tracking-wide text-mute">
              {typeName.get(balance.leaveTypeId) ?? balance.leaveTypeName}
            </p>
            <p className="mt-1 font-serif text-3xl text-navy">
              {balance.remaining}
              <span className="ml-1 text-base text-mute">{t("home.daysLeft")}</span>
            </p>
            <p className="mt-1 text-sm text-mute">
              {t("home.usedOf", {
                taken: balance.taken,
                allowance: balance.allowance ?? t("common.none"),
                year: leaveYear,
              })}
            </p>
          </Panel>
        ))}
      </div>

      {canApprove ? (
        <Panel className="mb-6">
          <PanelHeader title={t("home.waitingTitle")}>
            {pending.length === 0
              ? t("home.waitingNone")
              : t("home.waitingSome", { count: pending.length })}
          </PanelHeader>
          {pending.length > 0 ? (
            <Link
              href="/hr/approvals"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-navy-deep"
            >
              {t("home.waitingReview")}
            </Link>
          ) : null}
        </Panel>
      ) : null}

      <Panel className="mb-6">
        <PanelHeader title={t("home.offTodayTitle")}>
          {t("home.offTodayIntro", { date: today })}
        </PanelHeader>
        {offToday.length === 0 ? (
          <p className="text-sm text-mute">{t("home.offTodayNone")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {offToday.map((request) => {
              const person = employeeById.get(request.employeeId);
              return (
                <li key={request.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-navy">
                    {person ? displayName(person) : t("approvals.teamMember")}
                  </span>
                  <span className="text-mute">
                    {typeName.get(request.leaveTypeId) ?? t("newRequest.leaveType")} ·{" "}
                    <DateRange from={request.startDate} to={request.endDate} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="mb-6">
        <PanelHeader title={t("home.holidaysTitle")}>
          {nextHoliday ? t("home.holidaysIntro") : t("home.holidaysNone")}
        </PanelHeader>
        {upcomingHolidays.length === 0 ? (
          <p className="text-sm text-mute">{t("home.holidaysHint")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcomingHolidays.slice(0, 5).map((holiday) => (
              <li key={holiday.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-navy">{holiday.date}</span>
                <span className="text-mute">{holidayName(holiday)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={t("home.recentTitle")} />
        {myRequests.length === 0 ? (
          <p className="text-sm text-mute">
            {t("home.recentNone")}{" "}
            <Link href="/hr/requests/new" className="text-navy underline underline-offset-4">
              {t("home.requestLeave")}
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {myRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ink">
                    {typeName.get(request.leaveTypeId) ?? t("newRequest.leaveType")} ·{" "}
                    <DateRange from={request.startDate} to={request.endDate} /> ·{" "}
                    {request.requestedDays}{" "}
                    {request.requestedDays === 1 ? t("common.day") : t("common.days")}
                  </span>
                  <RequestStatusPill status={request.status} t={t} />
                </li>
              ))}
            </ul>
            <p className="mt-4">
              <Link href="/hr/requests" className="text-sm text-navy underline underline-offset-4">
                {t("home.seeAll")} →
              </Link>
            </p>
          </>
        )}
      </Panel>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-mute">
        {t("home.signedInAs", { name: me ? displayName(me) : t("common.none") })}{" "}
        <RolePill role={identity.role} t={t} />
      </p>
    </>
  );
}
