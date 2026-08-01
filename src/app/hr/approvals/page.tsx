import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listPendingApprovals } from "@/lib/hr/requests";
import { listEmployees, displayName } from "@/lib/hr/employees";
import { listLeaveTypes } from "@/lib/hr/policy";
import { getHrI18n } from "@/lib/hr/i18n";
import { PageHeader, EmptyState, DateRange, PanelHeader } from "../ui";
import { DecideButtons } from "../requests/request-actions-client";

export const metadata = { title: "Approvals · LingoPure People" };

/**
 * The approval queue.
 *
 * RLS already limits the rows to people the viewer can see, so a Manager sees
 * only their own team's requests without this page filtering anything. Staff
 * are redirected rather than shown an empty queue: a page titled "Approvals"
 * with nothing in it reads as broken rather than as not-for-you.
 *
 * Both the assigned Manager and a Super Admin see the same request here. That
 * is intentional, and it is why deciding is guarded by a conditional write
 * rather than a disabled button — two people on two devices never see each
 * other's disabled button.
 */
export default async function ApprovalsPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/approvals");
  if (identity.role === "staff") redirect("/hr");

  const [pending, employees, leaveTypes, { t, locale }] = await Promise.all([
    listPendingApprovals(),
    listEmployees(),
    listLeaveTypes(identity.orgId),
    getHrI18n(),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const typeName = new Map(
    leaveTypes.map((type) => [type.id, locale === "vi" ? type.nameVi : type.nameEn])
  );

  const decideLabels = {
    approve: t("approvals.approve"),
    approving: t("approvals.approving"),
    decline: t("approvals.decline"),
    declining: t("approvals.declining"),
    declineWhy: t("approvals.declineWhy"),
    declineWhyHint: t("approvals.declineWhyHint"),
    back: t("common.back"),
  };

  return (
    <>
      <PageHeader title={t("approvals.title")}>{t("approvals.intro")}</PageHeader>

      {pending.length === 0 ? (
        <EmptyState title={t("approvals.emptyTitle")}>
          {t("approvals.emptyBody")}
        </EmptyState>
      ) : (
        <>
          <PanelHeader title={t("approvals.awaiting", { count: pending.length })} />
          <ul className="flex flex-col gap-3">
            {pending.map((request) => {
              const person = employeeById.get(request.employeeId);
              return (
                <li key={request.id} className="rounded-lg border border-cream bg-paper p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-navy">
                        {person ? displayName(person) : t("approvals.teamMember")}
                      </p>
                      <p className="mt-1 text-sm text-mute">
                        {typeName.get(request.leaveTypeId) ?? t("newRequest.leaveType")} ·{" "}
                        {request.requestedDays}{" "}
                        {request.requestedDays === 1 ? t("common.day") : t("common.days")} ·{" "}
                        <DateRange from={request.startDate} to={request.endDate} />
                      </p>
                    </div>
                    {person?.department ? (
                      <span className="text-xs text-mute">{person.department}</span>
                    ) : null}
                  </div>

                  {request.reason ? (
                    <p className="mt-3 rounded-md bg-mist px-3 py-2 text-sm text-ink/80">
                      {request.reason}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-mute">{t("approvals.noReason")}</p>
                  )}

                  <DecideButtons requestId={request.id} labels={decideLabels} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
