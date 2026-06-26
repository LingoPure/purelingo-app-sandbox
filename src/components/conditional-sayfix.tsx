"use client";

import { usePathname } from "next/navigation";
import { SayFixWidget } from "@caistech/sayfix-embed";

/**
 * Renders the SayFix "Report a problem" pill everywhere EXCEPT:
 *  - the LCI Bridge interpreter page, where the floating pill sat on top of the
 *    hold-to-talk control on mobile (the core action opened the bug reporter).
 *  - the investor dataroom (/investor/*), a confidential investor-facing surface
 *    where the floating pill overlapped real content on several screens (both
 *    naive-tester personas flagged it) and where investors shouldn't be filing
 *    dev bug reports anyway.
 */
export function ConditionalSayFix({ repo }: { repo: string }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/lci-bridge")) return null;
  if (pathname?.startsWith("/investor")) return null;
  return <SayFixWidget repo={repo} />;
}
