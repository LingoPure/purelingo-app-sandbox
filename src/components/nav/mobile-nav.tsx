"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type MobileNavItem = {
  href: string;
  label: string;
  /** When true, only highlight as active on an exact pathname match. */
  exact?: boolean;
};

type Props = {
  items: MobileNavItem[];
  /**
   * Matches the LanguagePill convention:
   *   "light" = light text/borders for use on a dark header.
   *   "dark"  = dark text/borders for use on a light header.
   */
  tone?: "light" | "dark";
  /** Optional sign-out element rendered at the bottom of the drawer. */
  signOut?: React.ReactNode;
};

export function MobileNav({ items, tone = "light", signOut }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [drawerTop, setDrawerTop] = useState(64);

  // Close drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Position the drawer below whatever sticky chrome (demo banner + header)
  // currently sits at the top of the viewport. The demo banner is z-50 and
  // would otherwise cover the first nav items.
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      let top = 64;
      const header = document.querySelector("header");
      if (header) top = Math.max(top, header.getBoundingClientRect().bottom);
      const banner = document.querySelector(
        "[data-demo-banner]",
      ) as HTMLElement | null;
      if (banner) top = Math.max(top, banner.getBoundingClientRect().bottom);
      setDrawerTop(Math.round(top));
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, { passive: true });
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute);
    };
  }, [open]);

  const isLight = tone === "light";
  const buttonClass = isLight
    ? "border-paper/20 text-paper hover:bg-paper/10"
    : "border-navy/20 text-navy hover:bg-mist";
  const drawerClass = isLight
    ? "bg-navy text-paper border-cream"
    : "bg-paper text-navy border-cream";
  const linkActive = isLight ? "bg-paper/10 text-gold" : "bg-mist text-navy";
  const linkInactive = isLight
    ? "text-paper/80 hover:bg-paper/5 hover:text-paper"
    : "text-navy/70 hover:bg-mist hover:text-navy";
  const dividerClass = isLight ? "border-paper/15" : "border-navy/10";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-md border ${buttonClass}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            style={{ top: drawerTop }}
            className="fixed inset-x-0 bottom-0 z-30 bg-navy/40 backdrop-blur-sm"
          />
          <div
            id="mobile-nav-drawer"
            style={{ top: drawerTop }}
            className={`fixed inset-x-0 z-40 border-b shadow-xl ${drawerClass}`}
          >
            <nav className="flex flex-col px-4 py-3">
              {items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "flex min-h-[44px] items-center rounded-md px-3 font-mono text-[13px] uppercase tracking-[0.22em] " +
                      (active ? linkActive : linkInactive)
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
              {signOut && (
                <div className={`mt-3 border-t pt-3 ${dividerClass}`}>
                  {signOut}
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
