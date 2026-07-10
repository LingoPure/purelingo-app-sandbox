/**
 * Clean-view integrity gates (server wrappers).
 *
 * An empty room reads as a bug; a missing room reads as a page. These make
 * spec-only content ABSENT from the DOM — and, in production (canvas off),
 * absent from the serialized RSC payload too, because a server component that
 * returns null never renders its children into the output.
 *
 *   - Canvas OFF (production): return null → nothing shipped.
 *   - Canvas ON: delegate to the client SpecToggle → shown in Spec view,
 *     removed from the DOM in Clean view.
 */
import type { ReactNode } from "react";
import { CANVAS_ENABLED } from "./canvas-mode";
import { SpecToggle } from "./CanvasToggle.client";

export type SectionFill = "empty" | "partial" | "complete";

/**
 * Wrap a whole section. A `partial`/`complete` section always renders (it has
 * shippable content). An `empty` section renders only in Spec view.
 */
export function SectionGate({
  fill,
  children,
}: {
  fill: SectionFill;
  children: ReactNode;
}) {
  if (fill !== "empty") return <>{children}</>;
  if (!CANVAS_ENABLED) return null;
  return <SpecToggle>{children}</SpecToggle>;
}

/**
 * Render children only in Spec view (a partial section's empty sub-part, e.g.
 * the pending report image or the individual-outcomes column), so Clean view
 * collapses to just the filled content with no void beside it.
 */
export function SpecOnly({ children }: { children: ReactNode }) {
  if (!CANVAS_ENABLED) return null;
  return <SpecToggle>{children}</SpecToggle>;
}
