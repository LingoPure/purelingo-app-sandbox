"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import { RoughNode, seedFrom } from "@/components/whiteboard/rough";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

export function Contrast({
  action,
  x,
  y,
  width,
  height,
}: {
  action: Extract<BlockAction, { type: "contrast" }>;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const halfWidth = (width - 20) / 2;
  const fontFamily = useWhiteboardFont();

  return (
    <>
      <foreignObject x={x} y={y} width={width} height={height}>
        <div className="wb-write-on" style={{ display: "flex", gap: 20, width, color: "var(--wb-ink)", fontFamily }}>
          <div style={{ width: halfWidth }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#b45309", marginBottom: 4 }}>
              {action.leftLabel}
            </div>
            <div style={{ fontSize: 15, opacity: 0.85 }}>{action.left}</div>
          </div>
          <div style={{ width: halfWidth }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--wb-accent)", marginBottom: 4 }}>
              {action.rightLabel}
            </div>
            <div style={{ fontSize: 15 }}>{action.right}</div>
          </div>
        </div>
      </foreignObject>
      <RoughNode
        shape={{ kind: "line", x1: x + halfWidth + 10, y1: y + 4, x2: x + halfWidth + 10, y2: y + height - 4 }}
        seed={seedFrom(`contrast-divider-${action.id}`)}
        options={{ stroke: "var(--wb-dot)", strokeWidth: 1.5 }}
      />
    </>
  );
}
