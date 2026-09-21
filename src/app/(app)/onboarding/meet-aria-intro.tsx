"use client";

import { useState, useRef } from "react";

/**
 * "Meet Aria" pre-rendered intro card.
 *
 * Plays /videos/aria-intro.mp4 — a one-time HeyGen render produced by
 * `scripts/heygen-generate-intro.ts`. If the file is missing (404), the
 * card hides itself silently so a fresh deploy without a generated video
 * doesn't show a broken player to students.
 */
export function MeetAriaIntro({
  videoSrc = "/videos/aria-intro.mp4",
  posterSrc,
}: {
  videoSrc?: string;
  posterSrc?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Read the actual clip length from the video itself rather than a
  // hardcoded guess (ISS-056: label said "60s", the real HeyGen render was
  // 26s — a fixed number drifts every time the video is regenerated).
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (hidden) return null;

  function onPlayClick() {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      // Autoplay/play() rejection — leave UI alone, browser will show
      // its own controls when the user clicks the native play button.
    });
  }

  return (
    <section className="rounded-lg border border-cream bg-paper p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            {durationSeconds != null
              ? `${Math.round(durationSeconds)}s · Meet your coach`
              : "Meet your coach"}
          </p>
          <h2 className="mt-1 font-serif text-xl text-navy">
            A quick hello from Aria
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute hover:text-navy"
        >
          Skip intro
        </button>
      </div>

      <div className="relative overflow-hidden rounded-md border border-cream bg-mist/40">
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc}
          controls
          preload="metadata"
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setHidden(true)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDurationSeconds(d);
          }}
          className="block h-auto w-full"
        >
          Your browser doesn&apos;t support HTML5 video.
        </video>
        {!playing && (
          <button
            type="button"
            onClick={onPlayClick}
            aria-label="Play intro"
            className="absolute inset-0 flex items-center justify-center bg-navy/10 transition hover:bg-navy/20"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper/95 shadow-lg">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="currentColor"
                className="text-navy"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
