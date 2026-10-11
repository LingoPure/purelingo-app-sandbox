"use client";

import type { BlockAction } from "@/lib/whiteboard/schema";
import { getApprovedSource, isPendingExcerpt } from "@/lib/whiteboard/sources";
import { useWhiteboardFont } from "@/components/whiteboard/font-context";

/**
 * Renders the registry excerpt verbatim — never model-supplied text. A
 * pending placeholder entry shows a visibly red "Excerpt pending" card, per
 * the brief, so a reviewer can never mistake a placeholder for real cited
 * content.
 */
export function SourceEmbed({
  action,
  width,
}: {
  action: Extract<BlockAction, { type: "source_embed" }>;
  width: number;
}) {
  const source = getApprovedSource(action.sourceId);
  const fontFamily = useWhiteboardFont();

  if (!source || isPendingExcerpt(source)) {
    return (
      <div
        className="wb-write-on"
        style={{
          width,
          border: "2px dashed var(--wb-mark-pending-border)",
          background: "var(--wb-mark-pending-bg)",
          borderRadius: 6,
          padding: 10,
          color: "var(--wb-mark-pending-border)",
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>Excerpt pending</div>
        {source ? (
          <div>
            {source.title} — {source.publisher}. A human has not yet pasted the verbatim excerpt
            and page reference for this source.
          </div>
        ) : (
          <div>Unknown source id &quot;{action.sourceId}&quot;.</div>
        )}
      </div>
    );
  }

  return (
    <div className="wb-write-on" style={{ width, color: "var(--wb-ink)", fontFamily }}>
      <blockquote style={{ margin: 0, fontStyle: "italic", fontSize: 15 }}>
        &ldquo;{source.excerpt}&rdquo;
      </blockquote>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, fontFamily: "system-ui, sans-serif" }}>
        {source.title} — {source.publisher}
        {source.page ? `, p. ${source.page}` : ""}
      </div>
    </div>
  );
}
