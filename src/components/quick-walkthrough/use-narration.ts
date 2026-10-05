"use client";

import { useEffect, useRef, useState } from "react";

type Clip = "intro" | "outro";

const clipUrl = (clip: Clip) => `/api/demo/narration?clip=${clip}`;

/**
 * Voice-over for the 30-second preview: Aria speaks the intro line when a
 * playthrough (re)starts and the CTA line the instant it finishes. A single
 * shared <audio> element, driven by src/app/api/demo/narration/route.ts — a
 * public, non-auth route (no sign-in gate on a marketing surface), but it
 * serves only two FIXED, server-defined lines, never client text, so it is
 * not an open TTS proxy.
 *
 * `muted` is a volume toggle on the element, not a stop/start — flipping it
 * mid-line resumes in place (WCAG 1.4.2: audio that autoplays >3s needs a
 * way to silence it independent of system volume).
 *
 * Narration is supplementary, not load-bearing: every line it speaks is
 * already on screen as the step's own body copy, and any playback failure
 * (autoplay block, network, TTS outage) degrades to silence — the preview
 * keeps working either way.
 */
export function useWalkthroughNarration({
  playToken,
  finished,
}: {
  playToken: number;
  finished: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const play = (clip: Clip) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = clipUrl(clip);
    audio.muted = muted;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay refusal or network hiccup — narration is supplementary;
      // degrade silently rather than surface an error over a working demo.
    });
  };

  useEffect(() => {
    if (playToken > 0) play("intro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken]);

  useEffect(() => {
    if (finished) play("outro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return { muted, toggleMuted: () => setMuted((m) => !m) };
}
