"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LessonScript, Step } from "@/lib/whiteboard/schema";
import { isBlockAction } from "@/lib/whiteboard/schema";
import type { PlayerStatus } from "@/lib/whiteboard/player";

type Label = "Board note" | "Highlight" | "Circle" | "Source" | "Quick check";

function labelForStep(step: Step): Label {
  if (step.actions.some((a) => a.type === "quick_check")) return "Quick check";
  if (step.actions.some((a) => a.type === "source_embed")) return "Source";
  if (step.actions.some((a) => a.type === "highlight")) return "Highlight";
  if (step.actions.some((a) => a.type === "circle")) return "Circle";
  return "Board note";
}

function primaryBlockId(step: Step): string | null {
  const mark = step.actions.find((a) => a.type === "highlight" || a.type === "circle");
  if (mark && (mark.type === "highlight" || mark.type === "circle")) return mark.targetId;
  const block = step.actions.find(isBlockAction);
  return block ? block.id : null;
}

export function SidePanel({
  script,
  revealedStepIndices,
  status,
  onPulse,
  onAnswerCheck,
}: {
  script: LessonScript;
  revealedStepIndices: number[];
  status: PlayerStatus;
  onPulse: (blockId: string) => void;
  onAnswerCheck: (stepId: string, answer: string) => void;
}) {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [revealedStepIndices.length]);

  const lastStepIndex = revealedStepIndices[revealedStepIndices.length - 1];
  const lastStep = lastStepIndex != null ? script.steps[lastStepIndex] : null;
  const awaitingCheckAction =
    status === "awaiting_check"
      ? lastStep?.actions.find((a) => a.type === "quick_check")
      : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div ref={logRef} style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {revealedStepIndices.map((i) => {
          const step = script.steps[i];
          const label = labelForStep(step);
          const blockId = primaryBlockId(step);
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => blockId && onPulse(blockId)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                background: "none",
                padding: "8px 0",
                borderBottom: "1px solid var(--color-line, #dce3e3)",
                cursor: blockId ? "pointer" : "default",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-gold, #c8973a)",
                  marginBottom: 2,
                }}
              >
                {label}
              </span>
              <div style={{ fontSize: 14, color: "var(--color-ink, #0d1117)" }}>{step.narration}</div>
            </button>
          );
        })}
      </div>

      {awaitingCheckAction?.type === "quick_check" && lastStep && (
        <QuickCheckInput
          key={awaitingCheckAction.id}
          stepId={lastStep.id}
          prompt={awaitingCheckAction.prompt}
          mode={awaitingCheckAction.mode}
          options={awaitingCheckAction.options}
          onAnswer={(answer) => onAnswerCheck(lastStep.id, answer)}
        />
      )}
    </div>
  );
}

function QuickCheckInput({
  stepId,
  prompt,
  mode,
  options,
  onAnswer,
}: {
  stepId: string;
  prompt: string;
  mode: "choice" | "free_text" | "spoken";
  options?: string[];
  onAnswer: (answer: string) => void;
}) {
  const [freeText, setFreeText] = useState("");

  return (
    <div style={{ borderTop: "2px solid var(--color-gold, #c8973a)", paddingTop: 10, marginTop: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{prompt}</div>
      {mode === "choice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className="rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-mist"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {mode === "free_text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-line p-2 text-sm"
          />
          <button
            type="button"
            disabled={!freeText.trim()}
            onClick={() => onAnswer(freeText.trim())}
            className="self-end rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs uppercase tracking-wide text-navy disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}
      {mode === "spoken" && (
        <SpokenRecorder onDone={() => onAnswer(`[recorded locally for ${stepId}]`)} />
      )}
    </div>
  );
}

/**
 * Records with MediaRecorder for local playback only. Never uploads,
 * persists, or sends the audio anywhere — discarded on unmount and on
 * page unload. Phase 3's scoreSpokenResponse() stub is intentionally not
 * called here (see src/lib/whiteboard/scoring.ts).
 */
function SpokenRecorder({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "recording" | "recorded" | "denied">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const discard = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", discard);
    return () => {
      window.removeEventListener("pagehide", discard);
      discard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setStatus("denied");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setStatus("recorded");
  }

  function reRecord() {
    discard();
    chunksRef.current = [];
    setStatus("idle");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 11, color: "var(--color-mute, #8fa3b1)", margin: 0 }}>
        Recording stays on this device in the prototype.
      </p>
      {status === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="self-start rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs uppercase tracking-wide text-navy"
        >
          ● Record
        </button>
      )}
      {status === "recording" && (
        <button
          type="button"
          onClick={stopRecording}
          className="self-start rounded-md border border-coral/60 bg-coral/10 px-3 py-1.5 text-xs uppercase tracking-wide text-coral"
        >
          ■ Stop
        </button>
      )}
      {status === "recorded" && audioUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={reRecord} className="rounded-md border border-line px-3 py-1.5 text-xs">
              Re-record
            </button>
            <button
              type="button"
              onClick={() => {
                discard();
                onDone();
              }}
              className="rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs uppercase tracking-wide text-navy"
            >
              Done
            </button>
          </div>
        </div>
      )}
      {status === "denied" && (
        <p style={{ fontSize: 12, color: "var(--color-coral, #c94f3a)" }}>
          Microphone access denied — allow it to try the spoken check, or skip this prototype step.
        </p>
      )}
      {status === "denied" && (
        <button type="button" onClick={onDone} className="self-start rounded-md border border-line px-3 py-1.5 text-xs">
          Skip
        </button>
      )}
    </div>
  );
}
