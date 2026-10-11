"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

export function DefinitionList({
  action,
  width,
}: {
  action: Extract<BlockAction, { type: "definition_list" }>;
  width: number;
}) {
  const fontFamily = useWhiteboardFont();
  return (
    <div className="wb-write-on" style={{ width, color: "var(--wb-ink)", fontFamily }}>
      {action.title && (
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 17 }}>{action.title}</div>
      )}
      <dl style={{ margin: 0 }}>
        {action.items.map((item, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <dt style={{ display: "inline", fontWeight: 700 }}>{item.term}:</dt>{" "}
            <dd style={{ display: "inline", margin: 0 }}>{item.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
