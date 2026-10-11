"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import type { TextBlockPlan } from "@/lib/whiteboard/layout";
import { BLOCK_PADDING } from "@/lib/whiteboard/layout";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

type Props = {
  action: Extract<BlockAction, { type: "text_block" }>;
  width: number;
  height: number;
  plan: TextBlockPlan;
};

export function TextBlock({ width, height, plan }: Props) {
  const fontFamily = useWhiteboardFont();
  let wordIndex = 0;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        padding: BLOCK_PADDING,
        boxSizing: "border-box",
        color: "var(--wb-ink)",
        fontFamily,
        fontSize: 18,
        lineHeight: `${plan.lineHeight}px`,
      }}
    >
      {plan.lines.map((line, lineIdx) =>
        line.map((word, i) => {
          const delay = (wordIndex++) * 45;
          return (
            <span
              key={`${lineIdx}-${i}`}
              className="wb-write-on"
              style={{
                position: "absolute",
                left: word.x,
                top: lineIdx * plan.lineHeight,
                fontWeight: word.bold ? 700 : 400,
                whiteSpace: "nowrap",
                animationDelay: `${delay}ms`,
              }}
            >
              {word.text}
            </span>
          );
        })
      )}
    </div>
  );
}
