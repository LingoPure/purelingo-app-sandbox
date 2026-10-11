"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

export function Heading({
  action,
  width,
}: {
  action: Extract<BlockAction, { type: "heading" }>;
  width: number;
}) {
  const fontFamily = useWhiteboardFont();
  const fontSize = action.level === 1 ? 28 : 20;
  return (
    <div
      className="wb-write-on"
      style={{
        width,
        color: "var(--wb-accent)",
        fontFamily,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.25,
      }}
    >
      {action.text}
    </div>
  );
}
