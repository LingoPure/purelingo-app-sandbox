"use client";

/**
 * CanvasChrome — the fixed canvas-mode UI: the "not the production site"
 * bar and the Spec/Clean view toggle. Both render only when canvas mode
 * is enabled (NEXT_PUBLIC_CANVAS_MODE=true); in production they are
 * nothing, so the deploy is indistinguishable from the real site.
 */

import { CANVAS_ENABLED, useSpec } from "./SpecProvider";

export function CanvasBar() {
  if (!CANVAS_ENABLED) return null;
  return (
    <div className="sticky top-0 z-50 w-full bg-mark px-4 py-1.5 text-center font-mono text-[11px] uppercase tracking-widest text-paper">
      Sales flow canvas — not the production site
    </div>
  );
}

export function ViewToggle() {
  const { view, setView } = useSpec();
  if (!CANVAS_ENABLED) return null;
  return (
    <div className="fixed right-4 top-14 z-50 flex items-center gap-1 rounded-full border border-line bg-paper p-1 shadow-md">
      <button
        type="button"
        onClick={() => setView("spec")}
        aria-pressed={view === "spec"}
        className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
          view === "spec"
            ? "bg-navy text-paper"
            : "text-mute hover:text-navy"
        }`}
      >
        Spec
      </button>
      <button
        type="button"
        onClick={() => setView("clean")}
        aria-pressed={view === "clean"}
        className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
          view === "clean"
            ? "bg-navy text-paper"
            : "text-mute hover:text-navy"
        }`}
      >
        Clean
      </button>
    </div>
  );
}
