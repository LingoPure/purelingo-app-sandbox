"use client";

import { usePathname } from "next/navigation";
import { SayFixWidget } from "@caistech/sayfix-embed";

/**
 * Renders the SayFix "Report a problem" pill only where a floating corner pill
 * doesn't collide with the product. It is SUPPRESSED on:
 *  - /lci-bridge (pill sat on the hold-to-talk control),
 *  - /investor/* (confidential investor surface; pill overlapped content),
 *  - the marketing pages (review/CEO-facing, not a dev-bug surface),
 *  - the authenticated learner/employer app (dashboard, lessons, onboarding,
 *    classroom, exam, settings, employer) — the installed 0.4.x widget uses a
 *    static corner (no obstacle-avoidance) and overlapped real controls there.
 * It stays on the info/auth pages (/demo, /about, /pricing, /contact, /login…)
 * where a corner pill is harmless.
 */
const SUPPRESS_PREFIXES = [
  "/lci-bridge",
  "/investor",
  "/for-companies",
  "/for-individuals",
  "/method",
  "/book-a-demo",
  "/company",
  "/dashboard",
  "/lessons",
  "/onboarding",
  "/discovery",
  "/classroom",
  "/exam",
  "/settings",
  "/employer",
];

export function ConditionalSayFix({ repo }: { repo: string }) {
  const pathname = usePathname();
  if (!pathname) return <SayFixWidget repo={repo} />;
  if (pathname === "/") return null;
  if (SUPPRESS_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <SayFixWidget repo={repo} />;
}
