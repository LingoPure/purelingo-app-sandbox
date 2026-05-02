"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EmployerSignOut } from "../sign-out-button";

type NavItem = { href: string; label: string };

type Props = {
  items: NavItem[];
};

export function EmployerMobileNav({ items }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="employer-mobile-drawer"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-paper/20 text-paper hover:bg-paper/10"
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
            className="fixed inset-0 top-[64px] z-30 bg-navy/40 backdrop-blur-sm"
          />
          <div
            id="employer-mobile-drawer"
            className="fixed inset-x-0 top-[64px] z-40 border-b border-cream bg-navy text-paper shadow-xl"
          >
            <nav className="flex flex-col px-4 py-3">
              {items.map((item) => {
                const active =
                  item.href === "/employer"
                    ? pathname === "/employer"
                    : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "rounded-md px-3 py-3 font-mono text-[12px] uppercase tracking-[0.22em] " +
                      (active
                        ? "bg-paper/10 text-gold"
                        : "text-paper/80 hover:bg-paper/5 hover:text-paper")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-3 border-t border-paper/15 pt-3">
                <EmployerSignOut />
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
