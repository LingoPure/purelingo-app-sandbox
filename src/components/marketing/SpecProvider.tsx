"use client";

/**
 * Canvas-mode context. When CANVAS_ENABLED is false the view is locked to
 * "clean" and no toggle renders. When enabled, Spec vs Clean is a runtime
 * choice persisted to localStorage; the class is toggled on the .mkt root
 * and scoped CSS hides annotations/stage markers/empty slots in clean view.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CANVAS_ENABLED } from "./canvas-mode";

export { CANVAS_ENABLED };

export type CanvasView = "spec" | "clean";
const STORAGE_KEY = "lp_canvas_view";

interface SpecContextValue {
  view: CanvasView;
  setView: (v: CanvasView) => void;
}

const SpecContext = createContext<SpecContextValue>({
  view: "clean",
  setView: () => {},
});

export function SpecProvider({ children }: { children: ReactNode }) {
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

  return (
    <SpecContext.Provider value={{ view, setView }}>
      {children}
    </SpecContext.Provider>
  );
}

export function useSpec() {
  return useContext(SpecContext);
}
