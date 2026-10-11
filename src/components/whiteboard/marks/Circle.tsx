/**
 * Circle mark — a rough-drawn ellipse around the matched span, "drawn in"
 * as a single stroke via stroke-dasharray/dashoffset.
 */
"use client";

import type { CSSProperties } from "react";
import type { MarkRect } from "@/lib/whiteboard/layout";
import { RoughNode, seedFrom } from "@/components/whiteboard/rough";

export function Circle({
  rect,
  targetId,
  delayMs = 0,
}: {
  rect: MarkRect;
  targetId: string;
  delayMs?: number;
}) {
  const pad = 6;
  const x = rect.x - pad;
  const y = rect.y - pad;
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;
  const dashLen = Math.max(200, Math.round(Math.PI * (width + height)));

  return (
    <g
      className="wb-rough-draw"
      style={
        {
          "--wb-dash-len": dashLen,
          "--wb-draw-delay": `${delayMs}ms`,
        } as CSSProperties
      }
    >
      <RoughNode
        shape={{ kind: "ellipse", x, y, width, height }}
        seed={seedFrom(`circle-${targetId}-${rect.x}-${rect.y}`)}
        options={{ stroke: "var(--wb-accent)", strokeWidth: 2.5, fill: "none" }}
      />
    </g>
  );
}
