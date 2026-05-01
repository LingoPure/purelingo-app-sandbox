"use client";

import { Conversation } from "@elevenlabs/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  userId: string;
  studentName?: string | null;
  nativeLanguage: string;
  firstMessageLocalized: string;
};

type Status = "idle" | "connecting" | "connected" | "error";
type Transport = "webrtc" | "websocket";
type TranscriptEntry = {
  id: number;
  role: "user" | "agent";
  text: string;
};

const WEBRTC_FAILURE_HINTS = [
  "negotiation",
  "negotiationerror",
  "ice",
  "peerconnection",
  "peer connection",
  "webrtc",
  "could not find local track publication",
];

function looksLikeWebRTCFailure(message: string): boolean {
  const m = message.toLowerCase();
  return WEBRTC_FAILURE_HINTS.some((hint) => m.includes(hint));
}

function friendlyError(message: string): string {
  if (looksLikeWebRTCFailure(message)) {
    return "Your network is blocking voice traffic. We'll try a slower backup connection — if that also fails, switch to a different WiFi or use mobile data.";
  }
  if (/microphone|getusermedia|permission denied/i.test(message)) {
    return "Microphone access denied. Please allow it in your browser and try again.";
  }
  if (/not signed in|401/i.test(message)) {
    return "You're not signed in. Refresh the page and sign in again.";
  }
  return `Failed to start session — ${message}`;
}

/**
 * Full-page discovery-session experience.
 *
 *   - Auto-starts on mount (mic permission → token → startSession)
 *   - Live scrolling transcript captured via the SDK's onMessage callback
 *   - End button navigates to /dashboard?just-finished=1, where a banner
 *     polls until scoring completes
 *
 * Bypasses @elevenlabs/react ConversationProvider whose React state never
 * syncs after startSession resolves (SDK issue #663). We drive status
 * manually from the client-level callbacks. WebRTC failures auto-fall-back
 * to the WebSocket transport, with a 12-second watchdog catching the case
 * where the SDK hangs without firing any callback.
 */
export function DiscoverySession({
  userId,
  studentName,
  nativeLanguage,
  firstMessageLocalized,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const convRef = useRef<Conversation | null>(null);
  const triedWebSocketRef = useRef(false);
  const attemptConnectedRef = useRef(false);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartedRef = useRef(false);
  const transcriptIdRef = useRef(0);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  // Mount + cleanup. The cleanup endSession is a backstop for tab close
  // or back-navigation — the SDK would otherwise leave the LiveKit room
  // open until ElevenLabs reaps it.
  useEffect(() => {
    setHydrated(true);
    return () => {
      clearWatchdog();
      try {
        void convRef.current?.endSession();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Auto-scroll transcript to the latest turn whenever a new entry lands.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const startWithTransport = async (transport: Transport): Promise<void> => {
    const r = await fetch(`/api/convai/token?transport=${transport}`);
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      throw new Error(
        body.detail
          ? `${body.error ?? "token error"} — ${body.detail}`
          : body.error ?? `HTTP ${r.status}`
      );
    }
    const j = (await r.json()) as { token?: string; signedUrl?: string };

    const dynamicVariables = {
      user_id: userId,
      student_name: studentName ?? "",
      native_language: nativeLanguage,
      first_message_localized: firstMessageLocalized,
    };

    const triggerFallback = (logHint: string): boolean => {
      if (transport !== "webrtc" || triedWebSocketRef.current) return false;
      triedWebSocketRef.current = true;
      clearWatchdog();
      console.warn(
        "[discovery] webrtc failed, retrying on websocket transport",
        logHint
      );
      setError(
        "Voice connection blocked by your network — falling back to backup mode…"
      );
      setStatus("connecting");
      try {
        void convRef.current?.endSession();
      } catch {
        /* ignore */
      }
      convRef.current = null;
      attemptConnectedRef.current = false;
      setTimeout(() => {
        startWithTransport("websocket").catch((retryErr) => {
          const retryMsg =
            retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.error("[discovery] websocket fallback failed", retryErr);
          setError(friendlyError(retryMsg));
          setStatus("error");
        });
      }, 250);
      return true;
    };

    const callbacks = {
      onConnect: () => {
        console.info("[discovery] connected");
        clearWatchdog();
        attemptConnectedRef.current = true;
        setStatus("connected");
        setError(null);
      },
      onDisconnect: (details: { reason: string; message?: string }) => {
        console.info("[discovery] disconnected", details);
        clearWatchdog();
        if (details?.reason === "error") {
          if (triggerFallback(details.message ?? "disconnect:error")) return;
        }
        // Normal disconnect (user clicked End → we already navigated, or
        // agent ended, or fallback already ran). If we're still on the
        // page, drop back to idle.
        setStatus("idle");
        setIsSpeaking(false);
        setIsPaused(false);
        convRef.current = null;
      },
      onError: (err: unknown) => {
        console.error("[discovery] error", err);
        clearWatchdog();
        const msg = err instanceof Error ? err.message : String(err);
        if (looksLikeWebRTCFailure(msg) && triggerFallback(msg)) return;
        setError(friendlyError(msg));
        setStatus("error");
        convRef.current = null;
      },
      onModeChange: ({ mode }: { mode: string }) => {
        setIsSpeaking(mode === "speaking");
      },
      onMessage: (props: { message?: string; source?: string }) => {
        const msg = props?.message;
        if (!msg) return;
        const role: "user" | "agent" =
          props.source === "user" ? "user" : "agent";
        setTranscript((prev) => [
          ...prev,
          { id: ++transcriptIdRef.current, role, text: msg },
        ]);
      },
    };

    if (transport === "webrtc") {
      attemptConnectedRef.current = false;
      clearWatchdog();
      watchdogTimerRef.current = setTimeout(() => {
        if (!attemptConnectedRef.current) {
          console.warn(
            "[discovery] webrtc stuck after 12s with no onConnect — forcing fallback"
          );
          triggerFallback("startup-timeout");
        }
      }, 12_000);
    }

    if (transport === "websocket") {
      if (!j.signedUrl) throw new Error("signedUrl missing in token response");
      console.info("[discovery] signed URL fetched (websocket fallback)");
      const conv = await Conversation.startSession({
        signedUrl: j.signedUrl,
        connectionType: "websocket",
        dynamicVariables,
        ...callbacks,
      });
      convRef.current = conv;
      attemptConnectedRef.current = true;
      clearWatchdog();
      setStatus("connected");
      setError(null);
      return;
    }

    if (!j.token) throw new Error("token missing in token response");
    console.info("[discovery] token fetched (webrtc)");
    const conv = await Conversation.startSession({
      conversationToken: j.token,
      dynamicVariables,
      ...callbacks,
    });
    if (triedWebSocketRef.current) {
      console.warn(
        "[discovery] webrtc startSession resolved after fallback fired — discarding"
      );
      try {
        void conv.endSession();
      } catch {
        /* ignore */
      }
      return;
    }
    convRef.current = conv;
    attemptConnectedRef.current = true;
    clearWatchdog();
    setStatus("connected");
    setError(null);
  };

  const start = async () => {
    setError(null);
    setStatus("connecting");
    setIsPaused(false);
    triedWebSocketRef.current = false;
    attemptConnectedRef.current = false;
    clearWatchdog();
    console.info("[discovery] start", { userId, nativeLanguage });

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (mErr) {
      console.error("[discovery] mic denied", mErr);
      setError("Microphone access denied. Please allow it and try again.");
      setStatus("error");
      return;
    }

    try {
      await startWithTransport("webrtc");
    } catch (e) {
      console.error("[discovery] startSession threw", e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(friendlyError(detail));
      setStatus("error");
    }
  };

  // Auto-start on mount once hydrated. Single fire — fence behind the ref.
  useEffect(() => {
    if (!hydrated || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const tryAgain = () => {
    autoStartedRef.current = true; // already mounted; just re-fire
    setTranscript([]);
    void start();
  };

  // End and exit. The webhook fires server-side as soon as ElevenLabs
  // detects the disconnect, then runs scoreDiscoverySession() in-process.
  // We don't wait for the webhook — the dashboard banner polls until
  // scores appear. We DO await endSession() though: it tears down the
  // LiveKit room which owns the audio playback, and skipping the await
  // means navigation fires while the agent's audio element is still
  // decoding — that's why the agent kept talking after End was clicked.
  // Belt-and-suspenders: zero output volume + mute mic before awaiting,
  // so any in-flight TTS goes silent immediately even if teardown takes
  // a moment.
  const endAndExit = async () => {
    if (isEnding) return;
    console.info("[discovery] end and exit");
    setIsEnding(true);
    clearWatchdog();
    const conv = convRef.current;
    convRef.current = null;
    try {
      conv?.setVolume({ volume: 0 });
      conv?.setMicMuted(true);
      await conv?.endSession();
    } catch (err) {
      console.warn("[discovery] endSession threw", err);
    }
    router.push("/dashboard?just-finished=1");
  };

  // Pause / resume — for "I need to step away" mid-discovery. The SDK
  // has no native pause, so we mute the mic (agent stops getting input)
  // and zero the output volume (user hears nothing). We also send a
  // contextual update so the agent waits quietly rather than
  // monologuing into silence. Resume restores both and the user can
  // pick the conversation back up where they left off.
  const togglePause = () => {
    const conv = convRef.current;
    if (!conv || status !== "connected") return;
    const next = !isPaused;
    try {
      conv.setMicMuted(next);
      conv.setVolume({ volume: next ? 0 : 1 });
      if (next) {
        conv.sendContextualUpdate(
          "The user has paused the session and stepped away. Stop speaking and wait quietly. They will resume shortly."
        );
      } else {
        conv.sendContextualUpdate(
          "The user is back. Briefly acknowledge their return, then continue from where you left off."
        );
      }
    } catch (err) {
      console.warn("[discovery] toggle pause threw", err);
      return;
    }
    setIsPaused(next);
  };

  const ringClass = isPaused
    ? "ring-mute"
    : status === "connected"
    ? isSpeaking
      ? "ring-coral animate-pulse"
      : "ring-ai-green"
    : status === "error"
    ? "ring-coral/40"
    : "ring-gold animate-pulse"; // idle / connecting

  const statusText = isPaused
    ? "Paused — Aria is waiting"
    : status === "connected"
    ? isSpeaking
      ? "Aria is speaking"
      : "Listening to you"
    : status === "error"
    ? "Connection error"
    : "Connecting…";

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[560px] flex-col gap-4">
      {/* HEADER: avatar + status */}
      <header className="flex flex-shrink-0 items-center gap-4 rounded-lg border border-cream bg-paper p-5">
        <div
          className={`relative h-16 w-16 overflow-hidden rounded-full ring-4 ring-offset-2 ring-offset-paper ${ringClass}`}
        >
          <Image
            src="/kira-avatar.jpg"
            alt="Aria, your discovery consultant"
            fill
            sizes="64px"
            className="object-cover"
            priority
          />
        </div>
        <div className="flex-1">
          <h1 className="font-serif text-xl text-navy">Aria</h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            {statusText}
          </p>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-mute/70 sm:inline">
          status: {status}
        </span>
      </header>

      {/* TRANSCRIPT */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-cream bg-paper">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-cream px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Live transcript
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute/70">
            {transcript.length} {transcript.length === 1 ? "turn" : "turns"}
          </span>
        </div>
        <div
          ref={transcriptScrollRef}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {transcript.length === 0 ? (
            <p className="mt-8 text-center text-sm text-mute">
              {status === "connected"
                ? "Aria is about to speak — make sure your headphones are on."
                : status === "error"
                ? "No conversation yet. Try again to start."
                : "Connecting to Aria…"}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {transcript.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex flex-col ${
                    entry.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                    {entry.role === "user" ? "You" : "Aria"}
                  </span>
                  <p
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      entry.role === "user"
                        ? "bg-navy text-paper"
                        : "bg-mist text-ink"
                    }`}
                  >
                    {entry.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FOOTER: error + actions */}
      <footer className="flex flex-shrink-0 flex-col gap-3 rounded-lg border border-cream bg-paper p-5">
        {error && (
          <p className="rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
            {error}
          </p>
        )}

        {status === "error" ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={tryAgain}
              className="flex-1 rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
            >
              Try again
            </button>
            <Link
              href="/onboarding"
              className="flex-1 rounded-md border border-navy/20 px-5 py-2.5 text-center text-sm font-medium text-navy hover:bg-mist"
            >
              Back to overview
            </Link>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={togglePause}
              disabled={status !== "connected" || isEnding}
              className={`flex-1 rounded-md border px-5 py-3 text-sm font-medium hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50 ${
                isPaused
                  ? "border-ai-green/40 bg-ai-green/5 text-ai-green hover:bg-ai-green/10"
                  : "border-navy/30 bg-paper text-navy"
              }`}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => void endAndExit()}
              disabled={isEnding}
              className="flex-1 rounded-md border border-coral/40 bg-coral/10 px-6 py-3 text-sm font-medium text-coral hover:bg-coral/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEnding ? "Ending…" : "End session"}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-mute">
          Speak naturally. Aria will guide you through six dimensions over
          about twenty minutes. Need a moment? <span className="font-medium">Pause</span> mutes both sides — click{" "}
          <span className="font-medium">Resume</span> to pick back up.{" "}
          <span className="font-medium">End session</span> when you&apos;re done — your
          gap profile takes 30-60 seconds to compute.
        </p>
      </footer>
    </div>
  );
}
