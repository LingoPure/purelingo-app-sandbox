/**
 * Playback state machine + narration abstraction.
 *
 * States: idle → playing(step) → awaiting_check(step) → playing(next) → done,
 * plus paused. A step plays its narration and its actions together — board
 * actions for a step become visible as soon as the step starts; narration
 * speaks (or an equivalent reading-time delay elapses) in parallel, and the
 * step auto-advances when that finishes, unless it ends in a `quick_check`,
 * which holds the machine in `awaiting_check` until the learner responds.
 *
 * `reducePlayerState` is a pure function — this is the testable core.
 * `useWhiteboardPlayer` is the thin React wiring around it.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LessonScript } from "@/lib/whiteboard/schema";

export type PlayerStatus = "idle" | "playing" | "awaiting_check" | "paused" | "done";

export type PlayerState = {
  status: PlayerStatus;
  /** -1 before playback starts. */
  stepIndex: number;
  /** Every step index whose board actions should currently be visible. */
  revealedStepIndices: number[];
};

export function initialPlayerState(): PlayerState {
  return { status: "idle", stepIndex: -1, revealedStepIndices: [] };
}

export type PlayerEvent =
  | { type: "START" }
  | { type: "STEP_FINISHED" }
  | { type: "CHECK_ANSWERED" }
  | { type: "STEP_BACK" }
  | { type: "STEP_FORWARD" }
  | { type: "PAUSE" }
  | { type: "RESUME" };

function advanceOrFinish(state: PlayerState, totalSteps: number): PlayerState {
  const next = state.stepIndex + 1;
  if (next >= totalSteps) return { ...state, status: "done" };
  return {
    status: "playing",
    stepIndex: next,
    revealedStepIndices: [...state.revealedStepIndices, next],
  };
}

export function reducePlayerState(
  state: PlayerState,
  event: PlayerEvent,
  totalSteps: number,
  currentStepHasCheck: boolean
): PlayerState {
  switch (event.type) {
    case "START": {
      if (totalSteps === 0) return { ...state, status: "done" };
      return { status: "playing", stepIndex: 0, revealedStepIndices: [0] };
    }
    case "STEP_FINISHED": {
      if (state.status !== "playing") return state;
      if (currentStepHasCheck) return { ...state, status: "awaiting_check" };
      return advanceOrFinish(state, totalSteps);
    }
    case "CHECK_ANSWERED": {
      if (state.status !== "awaiting_check") return state;
      return advanceOrFinish({ ...state, status: "playing" }, totalSteps);
    }
    case "PAUSE":
      return state.status === "playing" || state.status === "awaiting_check"
        ? { ...state, status: "paused" }
        : state;
    case "RESUME":
      return state.status === "paused"
        ? { ...state, status: state.revealedStepIndices.length > state.stepIndex ? "playing" : "playing" }
        : state;
    case "STEP_BACK": {
      // Re-render the board to the end state of the previous step — no
      // reverse animation needed (per the brief). Revealed-set shrinks to
      // match; narration for the landed-on step is NOT replayed here (the
      // hook replays it on the next STEP_FINISHED-driving effect run).
      const prev = Math.max(0, state.stepIndex - 1);
      return {
        status: "playing",
        stepIndex: prev,
        revealedStepIndices: state.revealedStepIndices.filter((i) => i <= prev),
      };
    }
    case "STEP_FORWARD":
      return advanceOrFinish(state, totalSteps);
    default:
      return state;
  }
}

// ── Narration ───────────────────────────────────────────────────────────

export type NarrationHandle = { cancel: () => void };

export interface NarrationProvider {
  speak(text: string, opts: { rate: number; onEnd: () => void }): NarrationHandle;
  readonly kind: "speech-synthesis" | "reading-time";
}

const READING_WPM = 180;

function readingTimeMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = words / READING_WPM;
  return Math.max(600, (minutes * 60_000) / rate);
}

/** Fallback provider — used when speechSynthesis is unavailable or muted. */
export function createReadingTimeNarrationProvider(): NarrationProvider {
  return {
    kind: "reading-time",
    speak(text, { rate, onEnd }) {
      const timer = setTimeout(onEnd, readingTimeMs(text, rate));
      return { cancel: () => clearTimeout(timer) };
    },
  };
}

/** Real provider — window.speechSynthesis. A TTS service can implement the
 *  same NarrationProvider interface later without touching the player. */
export function createSpeechSynthesisNarrationProvider(): NarrationProvider {
  return {
    kind: "speech-synthesis",
    speak(text, { rate, onEnd }) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.onend = onEnd;
      utterance.onerror = onEnd; // never strand playback on a TTS error
      window.speechSynthesis.speak(utterance);
      return {
        cancel: () => {
          utterance.onend = null;
          utterance.onerror = null;
          window.speechSynthesis.cancel();
        },
      };
    },
  };
}

function speechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ── React wiring ────────────────────────────────────────────────────────

export type Speed = 0.75 | 1 | 1.25 | 1.5;

export function useWhiteboardPlayer(script: LessonScript) {
  const [state, setState] = useState<PlayerState>(initialPlayerState());
  const [speed, setSpeed] = useState<Speed>(1);
  const [muted, setMuted] = useState(false);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, string>>({});

  const narrationRef = useRef<NarrationHandle | null>(null);
  const totalSteps = script.steps.length;
  const currentStep = state.stepIndex >= 0 ? script.steps[state.stepIndex] : null;
  const currentStepHasCheck = useMemo(
    () => !!currentStep?.actions.some((a) => a.type === "quick_check"),
    [currentStep]
  );

  const provider = useMemo<NarrationProvider>(
    () =>
      !muted && speechSynthesisAvailable()
        ? createSpeechSynthesisNarrationProvider()
        : createReadingTimeNarrationProvider(),
    [muted]
  );

  const dispatch = useCallback(
    (event: PlayerEvent) =>
      setState((prev) => reducePlayerState(prev, event, totalSteps, currentStepHasCheck)),
    [totalSteps, currentStepHasCheck]
  );

  // Drive narration for the current step whenever we land on a new
  // `playing` step (not on pause/resume — those don't restart narration).
  const narratedStepIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (state.status !== "playing" || !currentStep) return;
    if (narratedStepIndexRef.current === state.stepIndex) return;
    narratedStepIndexRef.current = state.stepIndex;

    narrationRef.current?.cancel();
    narrationRef.current = provider.speak(currentStep.narration, {
      rate: speed,
      onEnd: () => dispatch({ type: "STEP_FINISHED" }),
    });

    return () => narrationRef.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on `speed` mid-utterance is intentionally not supported (Phase 1); speed takes effect on the next step.
  }, [state.status, state.stepIndex]);

  useEffect(() => {
    if (state.status === "paused") narrationRef.current?.cancel();
  }, [state.status]);

  useEffect(() => () => narrationRef.current?.cancel(), []);

  const play = useCallback(() => dispatch({ type: "START" }), [dispatch]);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), [dispatch]);
  const resume = useCallback(() => {
    // A resumed step replays its narration from the start — Phase 1 doesn't
    // track narration offset, so this is the honest behaviour rather than
    // silently resuming nothing.
    narratedStepIndexRef.current = -1;
    dispatch({ type: "RESUME" });
  }, [dispatch]);
  const stepBack = useCallback(() => {
    narratedStepIndexRef.current = -1;
    narrationRef.current?.cancel();
    dispatch({ type: "STEP_BACK" });
  }, [dispatch]);
  const stepForward = useCallback(() => {
    narrationRef.current?.cancel();
    dispatch({ type: "STEP_FORWARD" });
  }, [dispatch]);
  const answerCheck = useCallback(
    (stepId: string, answer: string) => {
      setCheckAnswers((prev) => ({ ...prev, [stepId]: answer }));
      dispatch({ type: "CHECK_ANSWERED" });
    },
    [dispatch]
  );

  return {
    state,
    currentStep,
    currentStepHasCheck,
    speed,
    setSpeed,
    muted,
    setMuted,
    checkAnswers,
    narrationKind: provider.kind,
    play,
    pause,
    resume,
    stepBack,
    stepForward,
    answerCheck,
  };
}
