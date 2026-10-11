"use client";

import type { CSSProperties } from "react";
import type { BlockAction } from "@/lib/whiteboard/schema";
import { RoughNode, seedFrom } from "@/components/whiteboard/rough";

/**
 * Tables keep the rough-drawn border look rather than HTML table styling
 * (per the brief): a rough outer rectangle + rough row/column separator
 * lines, drawn as SVG siblings at the block's board-absolute position, with
 * the cell text laid over them via foreignObject. Exact cell-height
 * matching against layout.ts's estimate isn't required — no mark ever
 * targets a table in Phase 1.
 */
export function Table({
  action,
  x,
  y,
  width,
  height,
}: {
  action: Extract<BlockAction, { type: "table" }>;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const titleHeight = action.title ? 28 : 0;
  const tableTop = y + titleHeight;
  const tableHeight = height - titleHeight;
  const rowCount = action.rows.length + 1; // + header
  const rowHeight = tableHeight / rowCount;
  const colWidth = width / action.columns.length;

  return (
    <>
      {action.title && (
        <foreignObject x={x} y={y} width={width} height={titleHeight}>
          <div
            className="wb-ink-text wb-write-on"
            style={{ fontWeight: 700, fontSize: 16, color: "var(--wb-ink)" }}
          >
            {action.title}
          </div>
        </foreignObject>
      )}

      <g className="wb-rough-draw" style={{ "--wb-dash-len": 1200 } as CSSProperties}>
        <RoughNode
          shape={{ kind: "rectangle", x, y: tableTop, width, height: tableHeight }}
          seed={seedFrom(`table-border-${action.id}`)}
          options={{ stroke: "var(--wb-ink)", strokeWidth: 1.5, fill: "none" }}
        />
        {Array.from({ length: rowCount - 1 }, (_, i) => i + 1).map((i) => (
          <RoughNode
            key={`row-${i}`}
            shape={{
              kind: "line",
              x1: x,
              y1: tableTop + i * rowHeight,
              x2: x + width,
              y2: tableTop + i * rowHeight,
            }}
            seed={seedFrom(`table-row-${action.id}-${i}`)}
            options={{ stroke: "var(--wb-ink)", strokeWidth: 1 }}
          />
        ))}
        {Array.from({ length: action.columns.length - 1 }, (_, i) => i + 1).map((i) => (
          <RoughNode
            key={`col-${i}`}
            shape={{
              kind: "line",
              x1: x + i * colWidth,
              y1: tableTop,
              x2: x + i * colWidth,
              y2: tableTop + tableHeight,
            }}
            seed={seedFrom(`table-col-${action.id}-${i}`)}
            options={{ stroke: "var(--wb-ink)", strokeWidth: 1 }}
          />
        ))}
      </g>

      <foreignObject x={x} y={tableTop} width={width} height={tableHeight}>
        <div className="wb-ink-text" style={{ width, height: tableHeight, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: rowHeight }}>
            {action.columns.map((col, i) => (
              <div
                key={i}
                style={{
                  width: colWidth,
                  padding: 6,
                  boxSizing: "border-box",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--wb-ink)",
                }}
              >
                {col}
              </div>
            ))}
          </div>
          {action.rows.map((row, r) => (
            <div key={r} style={{ display: "flex", height: rowHeight }}>
              {row.map((cell, c) => (
                <div
                  key={c}
                  style={{
                    width: colWidth,
                    padding: 6,
                    boxSizing: "border-box",
                    fontSize: 13,
                    color: "var(--wb-ink)",
                  }}
                >
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </foreignObject>
    </>
  );
}
