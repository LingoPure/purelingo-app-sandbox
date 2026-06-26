"use client";

import { usePathname } from "next/navigation";

/**
 * Renders the sticky "Strategic Platform Demo" band everywhere EXCEPT the
 * investor dataroom (/investor/*).
 *
 * The band warns that the CONSUMER product is a demo, not production
 * lingopure.com. The investor dataroom is a real, confidential tool, so the band
 * is both off-message there (it can read as "the dataroom is fake") AND it
 * collided with the investor layout's own sticky header — the body-level
 * `sticky top-0 z-50` band and the investor `sticky top-0` header fought for the
 * top of the viewport, which is what surfaced as the banner rendering mid-page
 * (both naive-tester personas flagged it). Omitting it on /investor/* fixes both.
 *
 * The (async server) <DemoBanner/> is passed as children; this client wrapper
 * only decides whether to mount it, by route.
 */
export function ConditionalDemoBanner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/investor")) return null;
  return <>{children}</>;
}
