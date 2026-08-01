"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HrRole } from "@/lib/hr/types";

export type HrNavItem = {
  href: string;
  label: string;
  /** Roles that see this item. Omitted means everyone. */
  roles?: HrRole[];
};

/**
 * Persistent HR navigation.
 *
 * Sidebar from `md:` up, hamburger drawer below. Both render the SAME item
 * list — a mobile nav that quietly drops items is how a phone user ends up
 * unable to reach a page that exists.
 *
 * Only items whose feature has actually shipped appear here. Listing a route
 * that 404s is worse than omitting it: the user cannot tell "not built yet"
 * from "broken", and the zero-dead-ends rule applies to nav as much as to
 * buttons.
 */
export function HrNav({
  items,
  role,
  displayName,
  roleLabel,
  menuLabels,
}: {
  items: HrNavItem[];
  role: HrRole;
  displayName: string;
  roleLabel: string;
  /** Screen-reader labels, resolved on the server like every other string. */
  menuLabels: { open: string; close: string; sections: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const visible = items.filter((i) => !i.roles || i.roles.includes(role));

  const isActive = (href: string) =>
    href === "/hr" ? pathname === "/hr" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    [
      "inline-flex min-h-[44px] w-full items-center rounded-md px-3 py-2",
      "text-sm font-medium transition",
      isActive(href)
        ? "bg-navy text-paper"
        : "text-mute hover:bg-mist hover:text-navy",
    ].join(" ");

  const navLinks = (
    <nav className="flex flex-col gap-1" aria-label={menuLabels.sections}>
      {visible.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={linkClass(item.href)}
          aria-current={isActive(item.href) ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile bar. The hamburger is top-left at a 44px target so it stays
          reachable one-handed. */}
      <div className="flex items-center justify-between border-b border-cream bg-paper px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="hr-mobile-nav"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-navy hover:bg-mist"
        >
          <span className="sr-only">{open ? menuLabels.close : menuLabels.open}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            {open ? (
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
        <span className="font-serif text-lg text-navy">
          LingoPure<span className="text-gold">.</span>
        </span>
        <span className="w-11" aria-hidden="true" />
      </div>

      {open && (
        <div id="hr-mobile-nav" className="border-b border-cream bg-paper px-4 py-3 md:hidden">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
            {displayName} · {roleLabel}
          </p>
          {navLinks}
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 flex-col border-r border-cream bg-paper px-4 py-6 md:flex md:w-60">
        <div className="mb-6">
          <Link href="/hr" className="font-serif text-xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
            People · {roleLabel}
          </p>
        </div>
        <div className="flex-1">{navLinks}</div>
        <p className="mt-4 truncate border-t border-cream pt-3 text-xs text-mute" title={displayName}>
          {displayName}
        </p>
      </aside>
    </>
  );
}
