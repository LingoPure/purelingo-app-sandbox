"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Mobile drawer for the marketing nav. On ≤860px the inline nav links are
 * hidden by CSS; this hamburger (shown only there) opens a drawer with the full
 * link set + CTA, so the nav is reachable with a thumb instead of vanishing.
 */
export function MktMobileMenu({
  links,
  cta,
}: {
  links: { label: string; href: string }[];
  cta: { label: string; href: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="mkt-hamburger"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {open ? (
        <div className="mkt-drawer" onClick={() => setOpen(false)}>
          <nav className="mkt-drawer-panel" onClick={(e) => e.stopPropagation()}>
            {links.map((l) => (
              <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href={cta.href} className="btn" onClick={() => setOpen(false)}>
              {cta.label}
            </Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}
