import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listRequests } from "@/lib/hr/requests";
import { listLeaveTypes, getOrgTimezone, getOrgPolicy } from "@/lib/hr/policy";
import { getBalances } from "@/lib/hr/balances";
import { todayInTimeZone, leaveYearOf } from "@/lib/hr/dates";
import { getHrI18n } from "@/lib/hr/i18n";
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

  const [leaveTypes, timezone, policy, { t, locale }] = await Promise.all([
    listLeaveTypes(identity.orgId),
    getOrgTimezone(identity.orgId),
    getOrgPolicy(identity.orgId),
    getHrI18n(),
  ]);

  const today = todayInTimeZone(timezone);
  const leaveYear = leaveYearOf(today, policy.leaveYearBasis, undefined);

  const [balances, requests] = await Promise.all([
    getBalances(identity.employeeId, leaveYear, leaveTypes),
    listRequests({ employeeId: identity.employeeId }),
  ]);

  const typeName = new Map(
    leaveTypes.map((type) => [type.id, locale === "vi" ? type.nameVi : type.nameEn])
  );
  const deducting = balances.filter((b) => b.deductsBalance);

  // Client components cannot call the server translator, so their strings are
  // resolved here and handed over as plain data.
  const cancelLabels = {
    cancelThis: t("myLeave.cancelThis"),
    approvedBody: t("myLeave.cancelApproved"),
    pendingBody: t("myLeave.cancelPending"),
    reason: t("myLeave.cancelReason"),
    confirm: t("myLeave.cancelConfirm"),
    keep: t("myLeave.cancelKeep"),
    working: t("common.saving"),
  };

  return (
    <>
      <PageHeader
        title={t("myLeave.title")}
        action={
          <Link href="/hr/requests/new" className={buttonPrimaryClass}>
            {t("home.requestLeave")}
          </Link>
        }
      >
        {t("myLeave.intro")}
      </PageHeader>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
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

      <PanelHeader title={t("myLeave.requestsTitle")}>
        {t("myLeave.requestsIntro")}
      </PanelHeader>

      {requests.length === 0 ? (
        <EmptyState title={t("myLeave.emptyTitle")}>{t("myLeave.emptyBody")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-cream bg-paper p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-navy">
                    {typeName.get(request.leaveTypeId) ?? t("newRequest.leaveType")} ·{" "}
                    {request.requestedDays}{" "}
                    {request.requestedDays === 1 ? t("common.day") : t("common.days")}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    <DateRange from={request.startDate} to={request.endDate} />
                    {request.startHalf || request.endHalf
                      ? ` · ${t("myLeave.includesHalfDay")}`
                      : ""}
                  </p>
                </div>
                <RequestStatusPill status={request.status} t={t} />
              </div>

              {request.reason ? (
                <p className="mt-3 text-sm text-ink/80">{request.reason}</p>
              ) : null}

              {request.decisionNote ? (
                <p className="mt-3 rounded-md bg-mist px-3 py-2 text-sm text-ink/80">
                  <span className="font-medium">
                    {request.status === "declined"
                      ? t("myLeave.declinedLabel")
                      : t("myLeave.noteLabel")}
                  </span>{" "}
                  {request.decisionNote}
                </p>
              ) : null}

              {request.status === "pending" || request.status === "approved" ? (
                <div className="mt-3">
                  <CancelRequestButton
                    requestId={request.id}
                    wasApproved={request.status === "approved"}
                    labels={cancelLabels}
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
