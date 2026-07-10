"use client";

/**
 * SpecProvider — the canvas-mode context.
 *
 * Canvas mode is gated by NEXT_PUBLIC_CANVAS_MODE at build time. When it
 * is not "true", canvas is OFF everywhere and cannot be turned on: no
 * toggle, no bar, no annotations, no empty slots — the page renders
 * exactly what a visitor would see.
 *
 * When canvas mode is available, the view (Spec vs Clean) is a runtime
 * choice persisted to localStorage. Spec view shows annotations and
 * empty slots; Clean view shows only visitor-facing content.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CanvasView = "spec" | "clean";

/** Build-time gate. Only "true" enables canvas mode at all. */
export const CANVAS_ENABLED =
  process.env.NEXT_PUBLIC_CANVAS_MODE === "true";

const STORAGE_KEY = "lp_canvas_view";

interface SpecContextValue {
  /** True only when canvas mode is enabled AND the user is in Spec view. */
  spec: boolean;
  view: CanvasView;
  setView: (v: CanvasView) => void;
}

const SpecContext = createContext<SpecContextValue>({
  spec: false,
  view: "clean",
  setView: () => {},
});

export function SpecProvider({ children }: { children: ReactNode }) {
  // Default to Spec view when canvas is enabled (the brief's default),
  // Clean otherwise. Read the persisted choice after mount to avoid
  // hydration mismatch.
  const [view, setViewState] = useState<CanvasView>(
    CANVAS_ENABLED ? "spec" : "clean"
  );

  useEffect(() => {
    if (!CANVAS_ENABLED) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "spec" || stored === "clean") setViewState(stored);
  }, []);

  const setView = (v: CanvasView) => {
    setViewState(v);
    if (CANVAS_ENABLED) window.localStorage.setItem(STORAGE_KEY, v);
  };

  const spec = CANVAS_ENABLED && view === "spec";

  return (
    <SpecContext.Provider value={{ spec, view, setView }}>
      {children}
    </SpecContext.Provider>
  );
}

export function useSpec() {
  return useContext(SpecContext);
}
