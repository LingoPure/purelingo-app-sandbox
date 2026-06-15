"use client";

import { useEffect, useRef, useState } from "react";

/**
 * LCI Bridge — single-device live interpreter (Route A).
 *
 * Two people share one device. Each picks the language they're about to speak,
 * holds the button, talks, releases. The app transcribes, translates into the
 * OTHER language, and speaks it aloud, then logs the turn.
 *
 *   pick lang ─▶ hold to talk ─▶ release ─▶ POST /api/interpret ─▶ speak + log
 *
 * Capture is PRESS-AND-HOLD on purpose (not auto-VAD): explicit start/stop is
 * the reliable choice on unknown networks/devices — no silence-detection
 * guesswork, no silent failure. Mic-denied and mobile-autoplay are handled
 * explicitly (the two things that break voice demos on phones).
 */

type Lang = { code: string; label: string; native: string; flag: string };

// Two-language demo. Add to this list to offer more; target is always "the
// other selected language" in a 2-party turn.
const LANGS: Lang[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "zh", label: "Mandarin", native: "中文", flag: "🇨🇳" },
];

type Turn = {
  id: number;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  audioUrl?: string;
};

type Status = "idle" | "listening" | "interpreting" | "playing" | "error";

export function LciBridgeClient() {
  const [speakerCode, setSpeakerCode] = useState<string>("en");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const turnIdRef = useRef(0);

  const speaker = LANGS.find((l) => l.code === speakerCode) ?? LANGS[0];
  const target = LANGS.find((l) => l.code !== speakerCode) ?? LANGS[1];
  const recording = status === "listening";
  const busy = status === "interpreting";

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Mobile browsers block audio that isn't started inside a user gesture. The
  // translated audio plays AFTER an async fetch, outside the original gesture,
  // so prime the element once on the first press to unlock it for the session.
  function unlockAudio() {
    if (unlockedRef.current) return;
    const el = audioRef.current;
    if (!el) return;
    el.play().then(
      () => {
        el.pause();
        el.currentTime = 0;
        unlockedRef.current = true;
      },
      () => {
        // No src yet / autoplay still blocked — the explicit Replay button is
        // the fallback. Don't fake success.
      }
    );
  }

  async function startListening() {
    if (recording || busy) return;
    setError(null);
    unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void interpret(blob);
      };
      recorder.start();
      setStatus("listening");
    } catch (err) {
      // The critical-gap fix: mic-denied is explicit, never a silent dead-end.
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone blocked. Tap the lock icon in your browser bar and allow the mic, then try again."
          : err instanceof Error
            ? `Microphone error: ${err.message}`
            : "Could not access the microphone.";
      setError(msg);
      setStatus("error");
    }
  }

  function stopListening() {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }

  async function interpret(blob: Blob) {
    if (blob.size === 0) {
      setError("Didn't catch that — hold the button while you speak.");
      setStatus("error");
      return;
    }
    setStatus("interpreting");
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "turn.webm");
      form.append("sourceLang", speaker.code);
      form.append("targetLang", target.code);
      const res = await fetch("/api/interpret", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as {
        sourceText?: string;
        translatedText?: string;
        audioUrl?: string;
        error?: string;
      };
      if (!res.ok || !body.translatedText) {
        setError(body.error ?? `Interpreter error (HTTP ${res.status})`);
        setStatus("error");
        return;
      }

      const turn: Turn = {
        id: ++turnIdRef.current,
        sourceLang: speaker.code,
        targetLang: target.code,
        sourceText: body.sourceText ?? "",
        translatedText: body.translatedText,
        audioUrl: body.audioUrl,
      };
      setTurns((prev) => [turn, ...prev]);

      if (body.audioUrl) {
        play(body.audioUrl);
      } else {
        // Text came back but voice leg failed — show it, note the gap.
        setStatus("idle");
        if (body.error) setError(body.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Interpreter request failed");
      setStatus("error");
    }
  }

  function play(url: string) {
    const el = audioRef.current;
    if (!el) return;
    el.src = url;
    setStatus("playing");
    el.play().then(
      () => {},
      () => {
        // Autoplay blocked despite priming — leave the turn visible with its
        // Replay button. Degrade, don't fake.
        setStatus("idle");
      }
    );
    el.onended = () => setStatus("idle");
  }

  const statusText: Record<Status, string> = {
    idle: "Pick your language, then hold to talk.",
    listening: `Listening in ${speaker.native}…`,
    interpreting: "Interpreting…",
    playing: `Speaking in ${target.native}…`,
    error: "Something went wrong — see below.",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Language picker — who is about to speak */}
      <div className="rounded-lg border border-cream bg-paper p-5">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          I&apos;m speaking
        </p>
        <div className="grid grid-cols-2 gap-3">
          {LANGS.map((l) => {
            const active = l.code === speakerCode;
            return (
              <button
                key={l.code}
                type="button"
                disabled={recording || busy}
                onClick={() => setSpeakerCode(l.code)}
                className={
                  "flex min-h-[56px] items-center justify-center gap-2 rounded-lg border px-4 py-3 text-base font-medium transition disabled:opacity-50 " +
                  (active
                    ? "border-navy bg-navy text-paper"
                    : "border-cream bg-paper text-navy hover:bg-mist")
                }
                aria-pressed={active}
              >
                <span className="text-xl">{l.flag}</span>
                <span>{l.native}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm text-mute">
          They&apos;ll hear it in{" "}
          <span className="font-medium text-ink">
            {target.flag} {target.native}
          </span>
        </p>
      </div>

      {/* Hold-to-talk */}
      <div className="flex flex-col items-center gap-4 rounded-lg border border-cream bg-paper p-6">
        <button
          type="button"
          disabled={busy}
          onPointerDown={(e) => {
            e.preventDefault();
            startListening();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            if (recording) stopListening();
          }}
          onPointerLeave={() => {
            if (recording) stopListening();
          }}
          className={
            "flex h-32 w-32 select-none items-center justify-center rounded-full text-paper shadow-md transition disabled:opacity-60 " +
            (recording
              ? "scale-105 bg-coral"
              : busy
                ? "bg-mute"
                : "bg-navy hover:bg-navy-deep")
          }
          style={{ touchAction: "none" }}
          aria-label={recording ? "Release to interpret" : "Hold to talk"}
        >
          <span className="text-4xl">{recording ? "●" : "🎙️"}</span>
        </button>
        <p
          className={
            "text-center text-sm " +
            (status === "error" ? "text-coral" : "text-mute")
          }
        >
          {statusText[status]}
        </p>
        <p className="text-center text-xs text-mute">
          Hold the circle while you speak, release when you&apos;re done.
        </p>
        {error && (
          <p className="max-w-md rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-center text-sm text-coral">
            {error}
          </p>
        )}
      </div>

      {/* Conversation log — newest first */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Conversation
          </p>
          {turns.map((t) => {
            const src = LANGS.find((l) => l.code === t.sourceLang);
            const tgt = LANGS.find((l) => l.code === t.targetLang);
            return (
              <div
                key={t.id}
                className="rounded-lg border border-cream bg-paper p-4"
              >
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                  {src?.flag} {src?.native} → {tgt?.flag} {tgt?.native}
                </p>
                <p className="text-sm text-mute">{t.sourceText}</p>
                <p className="mt-1 text-lg leading-relaxed text-ink">
                  {t.translatedText}
                </p>
                {t.audioUrl && (
                  <button
                    type="button"
                    onClick={() => play(t.audioUrl!)}
                    className="mt-2 rounded-md border border-cream px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:bg-mist"
                  >
                    ▶ Replay
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Single shared audio element, primed on first press for mobile autoplay */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
