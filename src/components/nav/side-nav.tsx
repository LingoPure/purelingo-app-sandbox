"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SideNavItem = {
  href: string;
  label: string;
  /** When true, only highlight as active on an exact pathname match. */
  exact?: boolean;
};

/**
 * Persistent left-rail navigation (desktop). Active route gets a gold left-border
 * accent + mist background. Mobile uses MobileNav (drawer) instead.
 */
export function SideNav({ items }: { items: SideNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-md border-l-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition " +
              (active
                ? "border-gold bg-mist text-navy"
                : "border-transparent text-navy/60 hover:bg-mist hover:text-navy")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
