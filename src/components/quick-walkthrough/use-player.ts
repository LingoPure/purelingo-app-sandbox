"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STEP_MS, WALKTHROUGH_STEPS } from "./content";

/**
 * Auto-advancing step-player state machine shared by both QuickWalkthrough
 * variants (marketing canvas + /demo page). Pure state/timing — rendering is
 * entirely up to the consumer.
 */
export function useWalkthroughPlayer() {
  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= WALKTHROUGH_STEPS.length - 1) {
        setFinished(true);
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    timerRef.current = setTimeout(advance, STEP_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, index, reducedMotion, advance]);

  const goTo = (i: number) => {
    setIndex(i);
    setFinished(false);
    setPlaying(!reducedMotion);
  };

  const replay = () => {
    setIndex(0);
    setFinished(false);
    setPlaying(!reducedMotion);
  };

  const pause = () => setPlaying(false);
  const resume = () => !finished && setPlaying(true);
  const togglePlaying = () => setPlaying((p) => !p);

  return {
    index,
    step: WALKTHROUGH_STEPS[index],
    playing,
    finished,
    reducedMotion,
    goTo,
    replay,
    pause,
    resume,
    togglePlaying,
  };
}
