import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listRequests } from "@/lib/hr/requests";
import { listLeaveTypes, getOrgTimezone, getOrgPolicy } from "@/lib/hr/policy";
import { getBalances } from "@/lib/hr/balances";
import { todayInTimeZone, leaveYearOf } from "@/lib/hr/dates";
import {
  PageHeader,
  Panel,
  PanelHeader,
  EmptyState,
  RequestStatusPill,
  DateRange,
  buttonPrimaryClass,
} from "../ui";
import { CancelRequestButton } from "./request-actions-client";

export const metadata = { title: "My requests · LingoPure People" };

/**
 * Your own leave: what you have left, and everything you have asked for.
 *
 * Balance and history sit on one page deliberately. "How many days do I have?"
 * and "what did I already book?" are the same question asked twice, and
 * splitting them across two screens means answering it takes two navigations.
 */
export default async function MyRequestsPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/requests");

  const [leaveTypes, timezone, policy] = await Promise.all([
    listLeaveTypes(identity.orgId),
    getOrgTimezone(identity.orgId),
    getOrgPolicy(identity.orgId),
  ]);

  const today = todayInTimeZone(timezone);
  const leaveYear = leaveYearOf(today, policy.leaveYearBasis, undefined);

  const [balances, requests] = await Promise.all([
    getBalances(identity.employeeId, leaveYear, leaveTypes),
    listRequests({ employeeId: identity.employeeId }),
  ]);

  const typeName = new Map(leaveTypes.map((t) => [t.id, t.nameEn]));
  const deducting = balances.filter((b) => b.deductsBalance);

  return (
    <>
      <PageHeader
        title="My leave"
        action={
          <Link href="/hr/requests/new" className={buttonPrimaryClass}>
            Request leave
          </Link>
        }
      >
        What you have left this year, and every request you have made. Days are
        only deducted once a request is approved.
      </PageHeader>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
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

      <PanelHeader title="Your requests">
        Pending requests can be withdrawn. Approved leave can be cancelled, and
        the days go back into your balance.
      </PanelHeader>

      {requests.length === 0 ? (
        <EmptyState title="You have not requested any leave yet">
          When you do, it will appear here with its status, and you can cancel it
          from this page.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-cream bg-paper p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-navy">
                    {typeName.get(request.leaveTypeId) ?? "Leave"} ·{" "}
                    {request.requestedDays} {request.requestedDays === 1 ? "day" : "days"}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    <DateRange from={request.startDate} to={request.endDate} />
                    {request.startHalf || request.endHalf ? " · includes a half day" : ""}
                  </p>
                </div>
                <RequestStatusPill status={request.status} />
              </div>

              {request.reason ? (
                <p className="mt-3 text-sm text-ink/80">{request.reason}</p>
              ) : null}

              {request.decisionNote ? (
                <p className="mt-3 rounded-md bg-mist px-3 py-2 text-sm text-ink/80">
                  <span className="font-medium">
                    {request.status === "declined" ? "Declined:" : "Note:"}
                  </span>{" "}
                  {request.decisionNote}
                </p>
              ) : null}

              {request.status === "pending" || request.status === "approved" ? (
                <div className="mt-3">
                  <CancelRequestButton
                    requestId={request.id}
                    wasApproved={request.status === "approved"}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
