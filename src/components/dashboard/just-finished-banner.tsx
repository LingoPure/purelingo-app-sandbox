"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  hasScores: boolean;
};

/**
 * Shown briefly after a discovery session ends. Polls the dashboard
 * (via router.refresh()) every 5 seconds until gap_scores rows appear,
 * then unmounts. Caps at 90 seconds — beyond that the existing
 * "scoring hasn't finished yet" inline hint takes over.
 *
 * Why polling instead of realtime: the webhook → score-discovery chain
 * runs server-side over ~30-60s. The student's session client has no
 * direct hook into the webhook completion. A cheap refresh loop on
 * the dashboard is the simplest signal.
 */
export function JustFinishedBanner({ hasScores }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justFinished = searchParams.get("just-finished") === "1";
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

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-5">
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.22em] text-gold">
        Session complete
      </p>
      <h2 className="mb-2 font-serif text-lg text-navy">
        {timedOut
          ? "Scoring is taking longer than expected"
          : "Your gap profile is being prepared…"}
      </h2>
      <p className="text-sm text-mute">
        {timedOut
          ? "If your scores still don't appear, click the Re-score button at the top right of the dashboard."
          : `We're analysing your conversation. This usually takes 30-60 seconds (${elapsed}s elapsed). Your gap profile will appear here automatically.`}
      </p>
    </div>
  );
}
