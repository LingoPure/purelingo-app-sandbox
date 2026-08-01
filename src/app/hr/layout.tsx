import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, displayName } from "@/lib/hr/employees";
import { getHrI18n } from "@/lib/hr/i18n";
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

/**
 * Nav items, localised.
 *
 * Built here in the SERVER layout rather than inside `HrNav`, which is a client
 * component. Resolving an employee's language means a database read, and the
 * translator is not something to ship to the browser — so the labels arrive
 * already translated and `HrNav` stays a presentational component that knows
 * nothing about locales.
 */
function navItems(t: (key: string) => string): HrNavItem[] {
  return [
    { href: "/hr", label: t("nav.overview") },
    { href: "/hr/requests", label: t("nav.myLeave") },
    { href: "/hr/calendar", label: t("nav.calendar") },
    { href: "/hr/approvals", label: t("nav.approvals"), roles: ["super_admin", "admin"] },
    { href: "/hr/team", label: t("nav.team"), roles: ["super_admin"] },
    { href: "/hr/holidays", label: t("nav.holidays"), roles: ["super_admin"] },
  ];
}

function roleLabel(role: HrRole, t: (key: string) => string): string {
  return t(`role.${role}`);
}

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr");

  const [me, { t }] = await Promise.all([getOwnEmployee(), getHrI18n()]);
  const name = me ? displayName(me) : t("nav.people");

  return (
    <div className="flex min-h-screen flex-col bg-mist md:flex-row">
      <HrNav
        items={navItems(t)}
        role={identity.role}
        displayName={name}
        roleLabel={roleLabel(identity.role, t)}
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
              {t("nav.settings")}
            </a>
            <form action={hrSignOut}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-mute transition hover:bg-mist hover:text-navy sm:w-auto"
              >
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
