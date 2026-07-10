"use client";

/**
 * MktShell — the marketing root. Applies the `.mkt` scope + marketing font
 * variables, toggles the `clean` class from canvas state, and (when canvas
 * is enabled) renders the Spec/Clean toggle and the "not the production
 * site" demobar. In production (canvas off) it is just the scoped wrapper.
 */

import type { ReactNode } from "react";
import { CANVAS_ENABLED, useSpec } from "./SpecProvider";
import { marketingFontVars } from "./marketing-fonts";

export function MktShell({ children }: { children: ReactNode }) {
  const { view, setView } = useSpec();
  const clean = view === "clean";
  return (
    <div className={`mkt ${marketingFontVars}${clean ? " clean" : ""}`}>
      {CANVAS_ENABLED ? (
        <>
          <div className="mkt-toggle" role="group" aria-label="Annotation layer">
            <button aria-pressed={!clean} onClick={() => setView("spec")}>
              Spec view
            </button>
            <button aria-pressed={clean} onClick={() => setView("clean")}>
              Clean view
            </button>
          </div>
          <div className="demobar">
            Sales flow canvas · not the production site ·{" "}
            <a href="https://lingopure.com">lingopure.com</a>
          </div>
        </>
      ) : null}
      {children}
    </div>
  );
}
