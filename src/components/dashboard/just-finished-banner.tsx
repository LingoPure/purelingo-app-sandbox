"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  hasScores: boolean;
};

/**
 * Shown briefly after a discovery session or assessment battery ends. The
 * Phase 0b flow lands here as `?just-finished=battery` (after the four-task
 * battery completes); the legacy `?just-finished=1` form is kept as a
 * fallback for the voice-only path.
 *
 * Polls (via router.refresh()) every 5 seconds until canonical gap_scores
 * rows appear, then unmounts. Caps at 90 seconds — beyond that the
 * existing inline "Re-score" hint takes over.
 *
 * Why polling instead of realtime: battery scoring runs server-side via
 * Next.js after() over ~30-60s. The client has no direct hook into the
 * scorer's completion. A cheap refresh loop on the dashboard is the
 * simplest signal.
 */
export function JustFinishedBanner({ hasScores }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const finishedParam = searchParams.get("just-finished");
  const finishedFromBattery = finishedParam === "battery";
  const finishedFromVoice = finishedParam === "1";
  const justFinished = finishedFromBattery || finishedFromVoice;

  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!justFinished || hasScores) return;
    const interval = setInterval(() => {
      setElapsed((e) => e + 5);
      router.refresh();
    }, 5_000);
    const timeout = setTimeout(() => {
      setTimedOut(true);
      clearInterval(interval);
    }, 90_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [justFinished, hasScores, router]);

  if (!justFinished) return null;
  if (hasScores) return null;

  const heading = timedOut
    ? "Scoring is taking longer than expected"
    : finishedFromBattery
      ? "Your full gap profile is being finalised…"
      : "Your gap profile is being prepared…";

  const body = timedOut
    ? "If your scores still don't appear, click the Re-score button at the top right of the dashboard."
    : finishedFromBattery
      ? `We're scoring your four battery responses and reconciling them with your voice profile. This usually takes 30-60 seconds (${elapsed}s elapsed).`
      : `We're analysing your conversation. This usually takes 30-60 seconds (${elapsed}s elapsed). Your gap profile will appear here automatically.`;

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-5">
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.22em] text-gold">
        {finishedFromBattery ? "Battery complete" : "Session complete"}
      </p>
      <h2 className="mb-2 font-serif text-lg text-navy">{heading}</h2>
      <p className="text-sm text-mute">{body}</p>
    </div>
  );
}
