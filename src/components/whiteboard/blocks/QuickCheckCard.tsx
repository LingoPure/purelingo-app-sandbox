"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

/**
 * Board-side display of a quick_check — a small card showing the prompt.
 * The actual interactive input (choice buttons / textarea / record button)
 * renders in the side panel (§8 of the brief), not on the board.
 */
export function QuickCheckCard({
  action,
  width,
}: {
  action: Extract<BlockAction, { type: "quick_check" }>;
  width: number;
}) {
  const fontFamily = useWhiteboardFont();
  return (
    <div
      className="wb-write-on"
      style={{
        width,
        border: "1.5px solid var(--wb-accent)",
        borderRadius: 6,
        padding: 10,
        color: "var(--wb-ink)",
      }}
    >
      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--wb-accent)",
          marginBottom: 4,
        }}
      >
        Quick check
      </div>
      <div style={{ fontSize: 16, fontFamily }}>
        {action.prompt}
      </div>
    </div>
  );
}
