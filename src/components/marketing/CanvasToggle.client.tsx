"use client";

/**
 * Client half of the canvas gates. Only ever mounted when canvas mode is on
 * (the server wrappers in CanvasGates.tsx guarantee that), so here the only
 * question is Spec vs Clean: render in Spec view, remove from the DOM in
 * Clean view.
 */
import type { ReactNode } from "react";
import { useSpec } from "./SpecProvider";

export function SpecToggle({ children }: { children: ReactNode }) {
  const { view } = useSpec();
  return view === "spec" ? <>{children}</> : null;
}
