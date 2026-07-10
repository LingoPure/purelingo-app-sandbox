"use client";

/**
 * AnnotationLayer — the visual canvas overlays.
 *
 * Everything here renders ONLY in Spec view (canvas mode on + view=spec).
 * In Clean view and in production (NEXT_PUBLIC_CANVAS_MODE!==true) these
 * components render null, so visitor-facing layout is unaffected.
 *
 * All overlays (stage marker, annotation callout) are absolutely
 * positioned so switching views never reflows the real content — only
 * empty slots (which stand in for not-yet-written copy) collapse.
 *
 * Colours come from the markup tokens in globals.css and are never used
 * by production UI: green = ready, amber = confirm, red = pending.
 */

import type { ReactNode } from "react";
import type { BlockStatus, Annotation } from "@/content/types";
import { useSpec } from "./SpecProvider";

const STATUS_TEXT: Record<BlockStatus, string> = {
  ready: "text-ai-green",
  confirm: "text-amber",
  pending: "text-mark",
};
const STATUS_DOT: Record<BlockStatus, string> = {
  ready: "bg-ai-green",
  confirm: "bg-amber",
  pending: "bg-mark",
};
const STATUS_LABEL: Record<BlockStatus, string> = {
  ready: "READY",
  confirm: "CONFIRM",
  pending: "PENDING",
};

/** Render children only in Spec view. */
export function SpecOnly({ children }: { children: ReactNode }) {
  const { spec } = useSpec();
  if (!spec) return null;
  return <>{children}</>;
}

/** Render children everywhere EXCEPT Spec view (i.e. Clean + production).
 *  Used for visitor-facing fallbacks that a spec empty slot replaces. */
export function CleanOnly({ children }: { children: ReactNode }) {
  const { spec } = useSpec();
  if (spec) return null;
  return <>{children}</>;
}

/** A small status pill (dot + label). Spec view only. */
export function StatusPill({ status }: { status: BlockStatus }) {
  const { spec } = useSpec();
  if (!spec) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${STATUS_TEXT[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Left-edge vertical stage marker for a section. Absolutely positioned,
 * so it never affects the section's own layout. Spec view only.
 */
export function StageMarker({
  stage,
  name,
  status,
}: {
  stage: string;
  name: string;
  status: BlockStatus;
}) {
  const { spec } = useSpec();
  if (!spec) return null;
  return (
    <div className="pointer-events-none absolute left-0 top-0 hidden h-full lg:block">
      <div className={`h-full w-1 ${STATUS_DOT[status]} opacity-70`} />
      <div className="absolute left-3 top-6 flex flex-col gap-1">
        <span className="font-mono text-xs font-semibold text-mute">
          {stage}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-widest text-mute"
          style={{ writingMode: "vertical-rl" }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

/** Annotation callout — the label + note that explains a block's state. */
export function AnnotationNote({ annotation }: { annotation: Annotation }) {
  const { spec } = useSpec();
  if (!spec) return null;
  return (
    <div className="mt-3 rounded-md border border-mark/30 bg-mark-bg px-3 py-2">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-mark">
        {annotation.label}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink/70">
        {annotation.note}
      </p>
    </div>
  );
}

/**
 * The empty slot that stands in for copy we have deliberately NOT
 * written. Renders a labelled dashed placeholder in Spec view; collapses
 * to nothing in Clean view and in production. An empty slot is
 * information — never fill it with invented copy.
 */
export function EmptySlot({
  annotation,
  minHeight = "6rem",
}: {
  annotation?: Annotation;
  minHeight?: string;
}) {
  const { spec } = useSpec();
  if (!spec) return null;
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-mark/40 bg-mark-bg/60 px-4 py-6 text-center"
      style={{ minHeight }}
    >
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-mark">
        {annotation?.label ?? "COPY PENDING"}
      </span>
      {annotation?.note ? (
        <p className="max-w-md text-xs leading-relaxed text-ink/60">
          {annotation.note}
        </p>
      ) : null}
    </div>
  );
}
