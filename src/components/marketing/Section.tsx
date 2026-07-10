import type { ReactNode } from "react";
import type { BlockStatus } from "@/content/types";
import { StageMarker } from "./AnnotationLayer";

/**
 * Section shell — consistent container + the spec-view stage marker.
 * The marker is absolutely positioned, so it never reflows the section.
 */
export function Section({
  stage,
  name,
  status,
  tone = "paper",
  children,
}: {
  stage: string;
  name: string;
  status: BlockStatus;
  tone?: "paper" | "soft" | "ink";
  children: ReactNode;
}) {
  const bg =
    tone === "soft" ? "bg-mist" : tone === "ink" ? "bg-navy text-paper" : "bg-paper";
  return (
    <section className={`relative ${bg}`}>
      <StageMarker stage={stage} name={name} status={status} />
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:pl-16">
        {children}
      </div>
    </section>
  );
}
