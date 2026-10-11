/**
 * Highlight mark — a translucent yellow rectangle behind the matched span,
 * mix-blend-mode: multiply (so it reads like a highlighter over ink, not an
 * opaque box). Not rough-drawn — the brief scopes rough.js to table
 * borders, circles and underlines only. Sweeps in left-to-right.
 */
"use client";

import type { MarkRect } from "@/lib/whiteboard/layout";

export function Highlight({ rect, delayMs = 0 }: { rect: MarkRect; delayMs?: number }) {
  return (
    <rect
      x={rect.x - 2}
      y={rect.y + 2}
      width={rect.width + 4}
      height={rect.height - 4}
      fill="var(--wb-highlight)"
      style={{ mixBlendMode: "multiply", animationDelay: `${delayMs}ms` }}
      className="wb-highlight-sweep"
    />
  );
}
