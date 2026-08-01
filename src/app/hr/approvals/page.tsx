import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listPendingApprovals } from "@/lib/hr/requests";
import { listEmployees, displayName } from "@/lib/hr/employees";
import { listLeaveTypes } from "@/lib/hr/policy";
import {
  PageHeader,
  EmptyState,
  DateRange,
  PanelHeader,
} from "../ui";
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
 * rather than by a disabled button — two people on two devices never see each
 * other's disabled button.
 */
export default async function ApprovalsPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/approvals");
  if (identity.role === "staff") redirect("/hr");

  const [pending, employees, leaveTypes] = await Promise.all([
    listPendingApprovals(),
    listEmployees(),
    listLeaveTypes(identity.orgId),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const typeName = new Map(leaveTypes.map((t) => [t.id, t.nameEn]));

  return (
    <>
      <PageHeader title="Approvals">
        Leave requests from your team waiting for a decision. Approving deducts
        the days straight away; declining does not, but tell them why. A Super
        Admin can act on these too, so a request may already have been decided
        by the time you get here.
      </PageHeader>

      {pending.length === 0 ? (
        <EmptyState title="Nothing waiting">
          When someone on your team requests leave it will appear here, and they
          will be told as soon as you decide.
        </EmptyState>
      ) : (
        <>
          <PanelHeader title={`${pending.length} awaiting a decision`} />
          <ul className="flex flex-col gap-3">
            {pending.map((request) => {
              const person = employeeById.get(request.employeeId);
              return (
                <li key={request.id} className="rounded-lg border border-cream bg-paper p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-navy">
                        {person ? displayName(person) : "A team member"}
                      </p>
                      <p className="mt-1 text-sm text-mute">
                        {typeName.get(request.leaveTypeId) ?? "Leave"} ·{" "}
                        {request.requestedDays}{" "}
                        {request.requestedDays === 1 ? "day" : "days"} ·{" "}
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
                    <p className="mt-3 text-sm italic text-mute">No reason given.</p>
                  )}

                  <DecideButtons requestId={request.id} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
