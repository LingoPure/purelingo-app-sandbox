import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, listEmployees, displayName } from "@/lib/hr/employees";
import { listLeaveTypes, getOrgTimezone, getOrgPolicy, listHolidays } from "@/lib/hr/policy";
import { getBalances } from "@/lib/hr/balances";
import { whoIsOff, listPendingApprovals, listRequests } from "@/lib/hr/requests";
import { todayInTimeZone, leaveYearOf, addDays } from "@/lib/hr/dates";
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
 */
export default async function HrHomePage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr");

  const [me, leaveTypes, timezone, policy] = await Promise.all([
    getOwnEmployee(),
    listLeaveTypes(identity.orgId),
    getOrgTimezone(identity.orgId),
    getOrgPolicy(identity.orgId),
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
  const typeName = new Map(leaveTypes.map((t) => [t.id, t.nameEn]));
  const deducting = balances.filter((b) => b.deductsBalance);
  const nextHoliday = upcomingHolidays[0] ?? null;

  return (
    <>
      <PageHeader
        title={me ? `Hello, ${me.firstName}` : "People"}
        action={
          <Link href="/hr/requests/new" className={buttonPrimaryClass}>
            Request leave
          </Link>
        }
      >
        Your leave balance, who is away, and what needs your attention. Days are
        deducted only after a request is approved.
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {deducting.map((balance) => (
          <Panel key={balance.leaveTypeId}>
            <p className="text-xs uppercase tracking-wide text-mute">
              {balance.leaveTypeName}
            </p>
            <p className="mt-1 font-serif text-3xl text-navy">
              {balance.remaining}
              <span className="ml-1 text-base text-mute">
                {balance.remaining === 1 ? "day" : "days"} left
              </span>
            </p>
            <p className="mt-1 text-sm text-mute">
              {balance.taken} of {balance.allowance ?? "—"} used in {leaveYear}
            </p>
          </Panel>
        ))}
      </div>

      {canApprove ? (
        <Panel className="mb-6">
          <PanelHeader title="Waiting for you">
            {pending.length === 0
              ? "Nothing from your team needs a decision right now."
              : `${pending.length} leave ${pending.length === 1 ? "request" : "requests"} from your team.`}
          </PanelHeader>
          {pending.length > 0 ? (
            <Link
              href="/hr/approvals"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-navy-deep"
            >
              Review {pending.length === 1 ? "it" : "them"}
            </Link>
          ) : null}
        </Panel>
      ) : null}

      <Panel className="mb-6">
        <PanelHeader title="Off today">
          Who is unavailable on {today}. Reasons stay private to the person and
          their manager.
        </PanelHeader>
        {offToday.length === 0 ? (
          <p className="text-sm text-mute">Everyone is in today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {offToday.map((request) => {
              const person = employeeById.get(request.employeeId);
              return (
                <li key={request.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-navy">
                    {person ? displayName(person) : "A colleague"}
                  </span>
                  <span className="text-mute">
                    {typeName.get(request.leaveTypeId) ?? "Leave"} ·{" "}
                    <DateRange from={request.startDate} to={request.endDate} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="mb-6">
        <PanelHeader title="Public holidays">
          {nextHoliday
            ? "Upcoming days off for everyone. These never come out of your balance."
            : "No public holidays are on the calendar yet."}
        </PanelHeader>
        {upcomingHolidays.length === 0 ? (
          <p className="text-sm text-mute">
            A Super Admin adds these. Until then, holidays are not excluded from
            leave day counts.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcomingHolidays.slice(0, 5).map((holiday) => (
              <li key={holiday.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-navy">{holiday.date}</span>
                <span className="text-mute">{holiday.nameEn}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Your recent requests" />
        {myRequests.length === 0 ? (
          <p className="text-sm text-mute">
            You have not requested any leave yet.{" "}
            <Link href="/hr/requests/new" className="text-navy underline underline-offset-4">
              Request some
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {myRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ink">
                    {typeName.get(request.leaveTypeId) ?? "Leave"} ·{" "}
                    <DateRange from={request.startDate} to={request.endDate} /> ·{" "}
                    {request.requestedDays}{" "}
                    {request.requestedDays === 1 ? "day" : "days"}
                  </span>
                  <RequestStatusPill status={request.status} />
                </li>
              ))}
            </ul>
            <p className="mt-4">
              <Link href="/hr/requests" className="text-sm text-navy underline underline-offset-4">
                See all my requests →
              </Link>
            </p>
          </>
        )}
      </Panel>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-mute">
        Signed in as {me ? displayName(me) : "—"} <RolePill role={identity.role} />
      </p>
    </>
  );
}
