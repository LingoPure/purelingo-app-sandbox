"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

export function PhraseBank({
  action,
  width,
}: {
  action: Extract<BlockAction, { type: "phrase_bank" }>;
  width: number;
}) {
  const fontFamily = useWhiteboardFont();
  return (
    <div className="wb-write-on" style={{ width, color: "var(--wb-ink)", fontFamily }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{action.title}</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {action.phrases.map((phrase, i) => (
          <li key={i} style={{ marginBottom: 4, fontSize: 15 }}>
            {phrase}
          </li>
        ))}
      </ul>
    </div>
  );
}
