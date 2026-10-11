"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { LessonScript, BlockAction } from "@/lib/whiteboard/schema";
import { isBlockAction } from "@/lib/whiteboard/schema";
import type { LessonLayout } from "@/lib/whiteboard/layout";
import { Heading } from "@/components/whiteboard/blocks/Heading";
import { TextBlock } from "@/components/whiteboard/blocks/TextBlock";
import { DefinitionList } from "@/components/whiteboard/blocks/DefinitionList";
import { Table } from "@/components/whiteboard/blocks/Table";
import { Contrast } from "@/components/whiteboard/blocks/Contrast";
import { PhraseBank } from "@/components/whiteboard/blocks/PhraseBank";
import { SourceEmbed } from "@/components/whiteboard/blocks/SourceEmbed";
import { QuickCheckCard } from "@/components/whiteboard/blocks/QuickCheckCard";
import { Highlight } from "@/components/whiteboard/marks/Highlight";
import { Circle } from "@/components/whiteboard/marks/Circle";
import "@/components/whiteboard/whiteboard.css";

export type BoardHandle = {
  /** Scrolls to and briefly pulses a block — used by the side panel's
   *  "clicking a label scrolls to and pulses the related element" rule. */
  pulse: (blockId: string) => void;
};

type Props = {
  script: LessonScript;
  layout: LessonLayout;
  revealedStepIndices: number[];
  zoom: number;
};

function actionsById(script: LessonScript): Map<string, BlockAction> {
  const map = new Map<string, BlockAction>();
  for (const step of script.steps) {
    for (const action of step.actions) {
      if (isBlockAction(action)) map.set(action.id, action);
    }
  }
  return map;
}

function renderBlockContent(
  action: BlockAction,
  block: LessonLayout["blocks"][string]
) {
  switch (action.type) {
    case "heading":
      return <Heading action={action} width={block.width} />;
    case "text_block":
      return block.textPlan ? (
        <TextBlock action={action} width={block.width} height={block.height} plan={block.textPlan} />
      ) : null;
    case "definition_list":
      return <DefinitionList action={action} width={block.width} />;
    case "phrase_bank":
      return <PhraseBank action={action} width={block.width} />;
    case "source_embed":
      return <SourceEmbed action={action} width={block.width} />;
    case "quick_check":
      return <QuickCheckCard action={action} width={block.width} />;
    default:
      return null;
  }
}

export const Board = forwardRef<BoardHandle, Props>(function Board(
  { script, layout, revealedStepIndices, zoom },
  ref
) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const blockElsRef = useRef<Map<string, HTMLElement | SVGElement>>(new Map());

  useImperativeHandle(ref, () => ({
    pulse(blockId: string) {
      const el = blockElsRef.current.get(blockId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      el.classList.remove("wb-pulse");
      // Re-trigger the animation even if it was already applied recently.
      void (el as HTMLElement).offsetWidth;
      el.classList.add("wb-pulse");
      setTimeout(() => el.classList.remove("wb-pulse"), 900);
    },
  }));

  const byId = useMemo(() => actionsById(script), [script]);
  const revealedStepIds = useMemo(
    () => new Set(revealedStepIndices.map((i) => script.steps[i]?.id).filter(Boolean)),
    [revealedStepIndices, script]
  );

  const revealedBlocks = useMemo(
    () =>
      Object.values(layout.blocks).filter((block) => {
        for (const step of script.steps) {
          if (!revealedStepIds.has(step.id)) continue;
          if (step.actions.some((a) => isBlockAction(a) && a.id === block.id)) return true;
        }
        return false;
      }),
    [layout.blocks, script.steps, revealedStepIds]
  );

  const revealedMarks = useMemo(
    () => layout.marks.filter((m) => revealedStepIds.has(m.stepId)),
    [layout.marks, revealedStepIds]
  );

  return (
    <div
      ref={scrollRef}
      className="wb-board-surface"
      style={{
        width: Math.min(layout.boardWidth * zoom, 900),
        height: layout.boardHeight * zoom,
        overflow: "auto",
        borderRadius: 10,
        border: "1px solid var(--wb-dot)",
      }}
    >
      <svg
        width={layout.boardWidth * zoom}
        height={layout.boardHeight * zoom}
        viewBox={`0 0 ${layout.boardWidth} ${layout.boardHeight}`}
      >
        {revealedBlocks.map((block) => {
          const action = byId.get(block.id);
          if (!action) return null;
          const isSvgNative = action.type === "table" || action.type === "contrast";
          const content = renderBlockContent(action, block);
          if (content == null) return null;

          if (isSvgNative) {
            // Table/Contrast render their own foreignObject + SVG siblings
            // at absolute coordinates, so pass through directly.
            return (
              <g
                key={block.id}
                ref={(el) => {
                  if (el) blockElsRef.current.set(block.id, el);
                  else blockElsRef.current.delete(block.id);
                }}
              >
                {action.type === "table" ? (
                  <Table action={action} x={block.x} y={block.y} width={block.width} height={block.height} />
                ) : (
                  <Contrast action={action} x={block.x} y={block.y} width={block.width} height={block.height} />
                )}
              </g>
            );
          }

          return (
            <foreignObject key={block.id} x={block.x} y={block.y} width={block.width} height={block.height}>
              <div
                // @ts-expect-error -- xmlns is required inside a foreignObject body
                xmlns="http://www.w3.org/1999/xhtml"
                ref={(el) => {
                  if (el) blockElsRef.current.set(block.id, el);
                  else blockElsRef.current.delete(block.id);
                }}
              >
                {content}
              </div>
            </foreignObject>
          );
        })}

        {revealedMarks.flatMap((mark, mi) =>
          mark.rects.map((rect, ri) =>
            mark.type === "highlight" ? (
              <Highlight key={`${mi}-${ri}`} rect={rect} delayMs={ri * 120} />
            ) : (
              <Circle key={`${mi}-${ri}`} rect={rect} targetId={mark.targetId} delayMs={ri * 120} />
            )
          )
        )}
      </svg>
    </div>
  );
});
