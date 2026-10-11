/**
 * The handwriting font's resolved CSS font-family string, shared between
 * every block component AND the layout engine's canvas-based measurer
 * (components/whiteboard/measure.ts). They MUST agree — a renderer using
 * one font while the layout measured with another would misplace every
 * highlight/circle rect. A React Context (rather than a CSS variable) is
 * used specifically so the exact same string also reaches the imperative
 * canvas API, which cannot read a CSS custom property.
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";

const WhiteboardFontContext = createContext<string>("cursive");

export function WhiteboardFontProvider({
  fontFamily,
  children,
}: {
  fontFamily: string;
  children: ReactNode;
}) {
  return (
    <WhiteboardFontContext.Provider value={fontFamily}>{children}</WhiteboardFontContext.Provider>
  );
}

export function useWhiteboardFont(): string {
  return useContext(WhiteboardFontContext);
}
