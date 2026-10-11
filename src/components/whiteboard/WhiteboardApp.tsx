"use client";

import { useMemo, useRef, useState } from "react";
import type { LessonScript } from "@/lib/whiteboard/schema";
import { computeLayout } from "@/lib/whiteboard/layout";
import { getApprovedSource } from "@/lib/whiteboard/sources";
import { useWhiteboardPlayer } from "@/lib/whiteboard/player";
import { createCanvasMeasurer } from "@/components/whiteboard/measure";
import { WhiteboardFontProvider } from "@/components/whiteboard/font-context";
import { Board, type BoardHandle } from "@/components/whiteboard/Board";
import { SidePanel } from "@/components/whiteboard/SidePanel";
import { Controls } from "@/components/whiteboard/Controls";

export function WhiteboardApp({
  script,
  fontFamily,
}: {
  script: LessonScript;
  fontFamily: string;
}) {
  const [zoom, setZoom] = useState(1);
  const boardRef = useRef<BoardHandle>(null);

  const measureText = useMemo(() => createCanvasMeasurer(fontFamily), [fontFamily]);
  const layout = useMemo(
    () => computeLayout(script, { measureText }, getApprovedSource),
    [script, measureText]
  );

  const player = useWhiteboardPlayer(script);

  return (
    <WhiteboardFontProvider fontFamily={fontFamily}>
      <div className="wb-root flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
              Lab prototype — not scored, nothing is saved
            </p>
            <h1 className="font-serif text-2xl text-navy">{script.title}</h1>
          </div>
          <UnmappedBadge script={script} />
        </div>

        <Controls
          status={player.state.status}
          onPlay={player.play}
          onPause={player.pause}
          onResume={player.resume}
          onStepBack={player.stepBack}
          onStepForward={player.stepForward}
          speed={player.speed}
          onSpeedChange={player.setSpeed}
          zoom={zoom}
          onZoomChange={setZoom}
          muted={player.muted}
          onMuteToggle={() => player.setMuted((m) => !m)}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <Board
            ref={boardRef}
            script={script}
            layout={layout}
            revealedStepIndices={player.state.revealedStepIndices}
            zoom={zoom}
          />
          <div className="min-h-[400px] w-full rounded-md border border-line p-3 lg:w-[360px]">
            <SidePanel
              script={script}
              revealedStepIndices={player.state.revealedStepIndices}
              status={player.state.status}
              onPulse={(blockId) => boardRef.current?.pulse(blockId)}
              onAnswerCheck={player.answerCheck}
            />
          </div>
        </div>

        {player.state.status === "done" && (
          <p className="text-sm text-mute">Lesson complete. Nothing was saved or scored.</p>
        )}
      </div>
    </WhiteboardFontProvider>
  );
}

function UnmappedBadge({ script }: { script: LessonScript }) {
  const unmapped = script.lp18Sublevel === "LP18_SUBLEVEL_TBD" || script.taxonomyRefs.length === 0;
  if (!unmapped) return null;
  return (
    <span
      title="This lesson has no measured LP-18 sublevel or taxonomy reference yet — it wasn't invented, it's just not mapped."
      className="rounded-full border border-mute/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-mute"
    >
      Unmapped
    </span>
  );
}
