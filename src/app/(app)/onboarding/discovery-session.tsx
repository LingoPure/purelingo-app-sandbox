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
  /** Pre-call context fed to Aria so she opens informed about who this
   * person is and what role they're being assessed for. */
  roleName?: string | null;
  roleDescription?: string | null;
  targetLevel?: string | null;
  employerName?: string | null;
};

type Status = "idle" | "connecting" | "connected" | "ended" | "error";
type TranscriptEntry = {
  id: number;
  role: "user" | "agent";
  text: string;
};

function friendlyError(message: string): string {
  if (/microphone|getusermedia|permission denied/i.test(message)) {
    return "Microphone access denied. Please allow it in your browser and try again.";
  }
  if (/not signed in|401/i.test(message)) {
    return "You're not signed in. Refresh the page and sign in again.";
  }
  return `Couldn't connect to Aria — ${message}`;
}

/**
 * Full-page discovery-session experience, WebSocket-only.
 *
 * Earlier versions tried WebRTC primary with a WebSocket fallback. The
 * handoff between transports raced against the SDK's onDisconnect
 * callback, which nulled out the active conversation ref and silently
 * disabled the Pause / End buttons. We've ripped the fallback dance out:
 * we always connect via WebSocket. Voice quality is identical (same
 * Rachel TTS, same latency-perceived response), but the connection works
 * behind every corporate / hotel / mobile network we've tested and the
 * student never sees a confusing "primary voice connection failed"
 * message.
 *
 * Each call to start() bumps a sessionGen counter that's captured by the
 * SDK callbacks. If the SDK fires onConnect / onDisconnect / onError /
 * onMessage for a stale session (e.g. a previously torn-down connection
 * whose teardown is still flushing), we silently no-op so the live
 * session's React state stays clean.
 */
export function DiscoverySession({
  userId,
  studentName,
  nativeLanguage,
  firstMessageLocalized,
  roleName,
  roleDescription,
  targetLevel,
  employerName,
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
  /** Bumped on every start() and every endAndExit(). SDK callbacks bound
   *  to a stale gen no-op — that's how we keep late teardown events from
   *  mutating the React state of a fresh session or a navigated-away
   *  page. */
  const sessionGenRef = useRef(0);
  const everConnectedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const transcriptIdRef = useRef(0);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  // Mount + cleanup. Cleanup endSession is a backstop for tab-close /
  // back-navigation; the SDK would otherwise leave the session open
  // until ElevenLabs reaps it server-side.
  useEffect(() => {
    setHydrated(true);
    return () => {
      sessionGenRef.current++; // any in-flight callbacks become stale
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

  const start = async () => {
    setError(null);
    setStatus("connecting");
    setIsPaused(false);
    everConnectedRef.current = false;
    const myGen = ++sessionGenRef.current;
    console.info("[discovery] start", { gen: myGen, userId, nativeLanguage });

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (mErr) {
      console.error("[discovery] mic denied", mErr);
      setError("Microphone access denied. Please allow it and try again.");
      setStatus("error");
      return;
    }

    let signedUrl: string;
    try {
      const r = await fetch(`/api/convai/token?transport=websocket`);
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
      const j = (await r.json()) as { signedUrl?: string };
      if (!j.signedUrl) throw new Error("signedUrl missing in token response");
      signedUrl = j.signedUrl;
    } catch (e) {
      console.error("[discovery] token fetch failed", e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(friendlyError(detail));
      setStatus("error");
      return;
    }

    // ConvAI's variable substitution is single-pass and won't recurse,
    // so any nested {{vars}} inside firstMessageLocalized must be
    // resolved client-side before the SDK sees them.
    const safeStudentName = studentName ?? "";
    const safeRoleName = roleName ?? "";
    const safeRoleDesc = roleDescription ?? "";
    const safeTargetLevel = targetLevel ?? "";
    const safeEmployerName = employerName ?? "";
    const interpolatedFirstMessage = firstMessageLocalized
      .replaceAll("{{student_name}}", safeStudentName)
      .replaceAll("{{role_name}}", safeRoleName)
      .replaceAll("{{employer_name}}", safeEmployerName)
      .replaceAll("{{target_level}}", safeTargetLevel)
      .replaceAll("{{native_language}}", nativeLanguage);

    const dynamicVariables = {
      user_id: userId,
      student_name: safeStudentName,
      native_language: nativeLanguage,
      first_message_localized: interpolatedFirstMessage,
      role_name: safeRoleName,
      role_description: safeRoleDesc,
      target_level: safeTargetLevel,
      employer_name: safeEmployerName,
    };

    const isStale = () => sessionGenRef.current !== myGen;

    const callbacks = {
      onConnect: () => {
        if (isStale()) return;
        console.info("[discovery] connected", { gen: myGen });
        everConnectedRef.current = true;
        setStatus("connected");
        setError(null);
      },
      onDisconnect: (details: { reason: string; message?: string }) => {
        if (isStale()) {
          console.info("[discovery] stale onDisconnect ignored", {
            gen: myGen,
            currentGen: sessionGenRef.current,
            details,
          });
          return;
        }
        console.info("[discovery] disconnected", { gen: myGen, details });
        // Don't null convRef here — endAndExit handles cleanup on the
        // user-initiated path. If the agent or network ended the call
        // unilaterally, route the student to their results.
        if (details?.reason === "error" && !everConnectedRef.current) {
          // Failed before ever connecting → let the user retry.
          setError(
            friendlyError(details.message ?? "connection ended unexpectedly")
          );
          setStatus("error");
          return;
        }
        // Either the agent ended the call, the network dropped after a
        // successful connection, or we're past natural completion.
        setStatus("ended");
        setIsSpeaking(false);
        setIsPaused(false);
      },
      onError: (err: unknown) => {
        if (isStale()) return;
        console.error("[discovery] error", { gen: myGen, err });
        const msg = err instanceof Error ? err.message : String(err);
        setError(friendlyError(msg));
        setStatus("error");
      },
      onModeChange: ({ mode }: { mode: string }) => {
        if (isStale()) return;
        setIsSpeaking(mode === "speaking");
      },
      onMessage: (props: { message?: string; source?: string }) => {
        if (isStale()) return;
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

    try {
      const conv = await Conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        dynamicVariables,
        ...callbacks,
      });
      // If our session was superseded while startSession was in-flight
      // (user clicked End or unmounted) tear this one down and bail.
      if (isStale()) {
        try {
          void conv.endSession();
        } catch {
          /* ignore */
        }
        return;
      }
      convRef.current = conv;
      // Belt-and-suspenders: onConnect timing varies; mark connected on
      // resolve too so we never get stuck in "connecting".
      everConnectedRef.current = true;
      setStatus("connected");
      setError(null);
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
    setTranscript([]);
    void start();
  };

  // End and exit. We bump sessionGen first so any in-flight or late SDK
  // callbacks are treated as stale and can't mutate state after the
  // user's already on their way to the dashboard. Each SDK call gets its
  // own try/catch — if one throws (half-open connection, etc.) we still
  // reach the navigate.
  const endAndExit = async () => {
    if (isEnding) return;
    console.info("[discovery] end and exit clicked");
    setIsEnding(true);
    sessionGenRef.current++;
    const conv = convRef.current;
    convRef.current = null;
    if (conv) {
      try {
        conv.setVolume({ volume: 0 });
      } catch (err) {
        console.warn("[discovery] setVolume(0) threw", err);
      }
      try {
        conv.setMicMuted(true);
      } catch (err) {
        console.warn("[discovery] setMicMuted(true) threw", err);
      }
      try {
        await conv.endSession();
        console.info("[discovery] endSession resolved");
      } catch (err) {
        console.warn("[discovery] endSession threw", err);
      }
    }
    router.push("/dashboard?just-finished=1");
  };

  // Pause / resume. The SDK has no native pause — we mute the mic
  // (agent stops getting input), zero output volume (user hears
  // nothing), and send a contextual update so Aria pauses speaking
  // rather than continuing to talk to a silent room.
  const togglePause = () => {
    const conv = convRef.current;
    if (!conv || status !== "connected") {
      console.info("[discovery] pause clicked but no live conv", {
        hasConv: Boolean(conv),
        status,
      });
      return;
    }
    const next = !isPaused;
    try {
      conv.setMicMuted(next);
    } catch (err) {
      console.warn("[discovery] setMicMuted threw", err);
    }
    try {
      conv.setVolume({ volume: next ? 0 : 1 });
    } catch (err) {
      console.warn("[discovery] setVolume threw", err);
    }
    try {
      conv.sendContextualUpdate(
        next
          ? "The user has paused the session and stepped away. Stop speaking and wait quietly. They will resume shortly."
          : "The user is back. Briefly acknowledge their return, then continue from where you left off."
      );
    } catch (err) {
      console.warn("[discovery] sendContextualUpdate threw", err);
    }
    setIsPaused(next);
  };

  const ringClass = isPaused
    ? "ring-mute"
    : status === "connected"
    ? isSpeaking
      ? "ring-coral animate-pulse"
      : "ring-ai-green"
    : status === "ended"
    ? "ring-ai-green/40"
    : status === "error"
    ? "ring-coral/40"
    : "ring-gold animate-pulse"; // idle / connecting

  const statusText = isPaused
    ? "Paused — Aria is waiting"
    : status === "connected"
    ? isSpeaking
      ? "Aria is speaking"
      : "Listening to you"
    : status === "ended"
    ? "Session complete — head to your dashboard"
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
                : status === "ended"
                ? "Session ended before any turns were captured."
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
        ) : status === "ended" ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard?just-finished=1")}
              className="flex-1 rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
            >
              View your results
            </button>
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
