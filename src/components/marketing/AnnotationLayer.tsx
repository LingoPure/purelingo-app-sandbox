/**
 * Canvas annotation primitives — the explainer boxes, stage spine, and the
 * dashed empty slots. All gated by CANVAS_ENABLED (return null in production
 * so the deploy is a clean marketing site). In canvas mode, scoped CSS hides
 * them in Clean view; they show in Spec view.
 */
import type { ReactNode } from "react";
import { CANVAS_ENABLED } from "./canvas-mode";
import type { BlockStatus, Annotation } from "@/content/types";

const ANNO_CLASS: Record<BlockStatus, string> = {
  ready: "anno ready",
  confirm: "anno confirm",
  pending: "anno",
};

/** Explainer box. `pending` = red (evidence pending), `confirm` = amber,
 *  `ready` = green. Renders the draft copy's status note. */
export function Anno({
  annotation,
  status = "pending",
  className,
}: {
  annotation: Annotation;
  status?: BlockStatus;
  className?: string;
}) {
  if (!CANVAS_ENABLED) return null;
  return (
    <div className={`${ANNO_CLASS[status]}${className ? ` ${className}` : ""}`}>
      <b>{annotation.label}</b>
      {annotation.note}
    </div>
  );
}

/** Vertical left-edge stage marker (e.g. "01 · Promise"). */
export function Stage({ children }: { children: ReactNode }) {
  if (!CANVAS_ENABLED) return null;
  return <span className="stage">{children}</span>;
}

/** Dashed empty slot for a genuinely unfillable sub-item. */
export function EmptySlot({
  title,
  children,
  plain = false,
}: {
  title: string;
  children?: ReactNode;
  plain?: boolean;
}) {
  if (!CANVAS_ENABLED) return null;
  return (
    <div
      className="slot--empty"
      style={plain ? { border: "none", background: "none" } : undefined}
    >
      <strong>{title}</strong>
      {children}
    </div>
  );
}
