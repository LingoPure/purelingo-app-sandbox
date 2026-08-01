import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, displayName } from "@/lib/hr/employees";
import { HrNav, type HrNavItem } from "./hr-nav";
import { hrSignOut } from "./actions";
import type { HrRole } from "@/lib/hr/types";

export const metadata = {
  title: "People · LingoPure",
  description: "Leave requests, balances and team management for LingoPure staff.",
};

/**
 * Chrome for every authenticated HR route.
 *
 * The gate is `getHrIdentity()`, which resolves through `hr_current_employee()`
 * — so someone with a LingoPure account who is not a member of staff lands back
 * at login rather than at an empty HR page. This is a convenience, not the
 * security boundary: RLS is, and it holds even if this check were removed.
 *
 * Nav lists ONLY surfaces that exist today — a nav item pointing at a 404 reads
 * as broken software, and the user cannot tell that apart from "not built yet".
 * The team calendar and public-holiday management arrive with #7 and get their
 * entries then.
 */

const ROLE_LABELS: Record<HrRole, string> = {
  super_admin: "Super Admin",
  admin: "Manager",
  staff: "Staff",
};

const NAV_ITEMS: HrNavItem[] = [
  { href: "/hr", label: "Overview" },
  { href: "/hr/requests", label: "My leave" },
  { href: "/hr/calendar", label: "Team calendar" },
  { href: "/hr/approvals", label: "Approvals", roles: ["super_admin", "admin"] },
  { href: "/hr/team", label: "Team members", roles: ["super_admin"] },
  { href: "/hr/holidays", label: "Public holidays", roles: ["super_admin"] },
];

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr");

  const me = await getOwnEmployee();
  const name = me ? displayName(me) : "Signed in";

  return (
    <div className="flex min-h-screen flex-col bg-mist md:flex-row">
      <HrNav
        items={NAV_ITEMS}
        role={identity.role}
        displayName={name}
        roleLabel={ROLE_LABELS[identity.role]}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-10">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>

        {/* Settings and Sign Out are anchored at the end of every authenticated
            route, per the app-chrome standard. On mobile they sit at the bottom
            of the page rather than inside the drawer, so they are reachable
            without opening the menu. */}
        <footer className="border-t border-cream bg-paper px-4 py-4 sm:px-6 md:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a
              href="/hr/settings"
              className="inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-mute transition hover:bg-mist hover:text-navy"
            >
              Settings
            </a>
            <form action={hrSignOut}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-mute transition hover:bg-mist hover:text-navy sm:w-auto"
              >
                Sign out
              </button>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
