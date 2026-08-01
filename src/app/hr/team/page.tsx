import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listEmployees, listPotentialManagers } from "@/lib/hr/employees";
import { todayInTimeZone } from "@/lib/hr/dates";
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

  const [employees, managers, headerList] = await Promise.all([
    listEmployees({ includeDeactivated: true }),
    listPotentialManagers(),
    headers(),
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
      <PageHeader title="Team members">
        Everyone at LingoPure with an account. Add a person here to give them
        access to request leave; assign them a manager to decide who approves it.
        Deactivating someone keeps their leave history but removes their access.
      </PageHeader>

      <AddMemberForm
        managers={managers}
        origin={origin}
        defaultStartDate={todayInTimeZone("Asia/Ho_Chi_Minh")}
      />

      {active.length === 0 ? (
        <EmptyState title="No team members yet">
          Add your first colleague above. They will get an email invitation and
          can sign in as soon as they accept it.
        </EmptyState>
      ) : (
        <TeamTable employees={active} byId={byId} />
      )}

      {deactivated.length > 0 ? (
        <div className="mt-10">
          <h2 className="mb-3 font-serif text-lg text-navy">Deactivated</h2>
          <p className="mb-4 max-w-prose text-sm text-mute">
            These people can no longer sign in. Their leave history is kept, so
            past balances and approvals stay auditable.
          </p>
          <TeamTable employees={deactivated} byId={byId} />
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
}: {
  employees: Awaited<ReturnType<typeof listEmployees>>;
  byId: Map<string, Awaited<ReturnType<typeof listEmployees>>[number]>;
}) {
  const managerName = (managerId: string | null) => {
    if (!managerId) return "—";
    const m = byId.get(managerId);
    return m ? `${m.firstName} ${m.lastName}` : "—";
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
              <StatusPill status={e.status} />
            </div>
            <p className="mt-1 break-all text-sm text-mute">{e.email}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">Role</dt>
                <dd className="mt-1"><RolePill role={e.hrRole} /></dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">Reports to</dt>
                <dd className="mt-1 text-ink">{managerName(e.managerId)}</dd>
              </div>
              {e.jobTitle ? (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-mute">Job title</dt>
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
              <th scope="col" className="px-4 py-3 font-medium text-navy">Name</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">Role</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">Reports to</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">Department</th>
              <th scope="col" className="px-4 py-3 font-medium text-navy">Status</th>
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
                <td className="px-4 py-3"><RolePill role={e.hrRole} /></td>
                <td className="px-4 py-3 text-ink">{managerName(e.managerId)}</td>
                <td className="px-4 py-3 text-ink">{e.department ?? "—"}</td>
                <td className="px-4 py-3"><StatusPill status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
