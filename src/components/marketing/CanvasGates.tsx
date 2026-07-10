/**
 * Clean-view integrity gates (server wrappers).
 *
 * Spec-only content (empty sections, and a partial section's empty sub-column)
 * is rendered inside a `.mkt-speconly` wrapper (`display:contents`, so it does
 * not affect layout) and HIDDEN in clean view by a single CSS rule
 * (`.mkt.clean .mkt-speconly { display:none }`). Toggling spec↔clean is then a
 * style recalc, NOT a React reconciliation — no mount/unmount churn on click
 * (the INP fix). In production (canvas off) these return null, so the content
 * is never even in the payload.
 */
import type { ReactNode } from "react";
import { CANVAS_ENABLED } from "./canvas-mode";

export type SectionFill = "empty" | "partial" | "complete";

/**
 * Wrap a whole section. `partial`/`complete` always render. An `empty` section
 * renders (canvas on) but is CSS-hidden in clean view; in production it's null.
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
  return (
    <div className="mkt-speconly" style={{ display: "contents" }}>
      {children}
    </div>
  );
}

/** Render children only in spec view (a partial section's empty sub-part). */
export function SpecOnly({ children }: { children: ReactNode }) {
  if (!CANVAS_ENABLED) return null;
  return (
    <div className="mkt-speconly" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
