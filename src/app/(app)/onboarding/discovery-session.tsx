"use client";

import { Conversation } from "@elevenlabs/client";
import { useEffect, useRef, useState } from "react";

type Props = {
  userId: string;
  studentName?: string | null;
  nativeLanguage: string;
  firstMessageLocalized: string;
  startLabel: string;
  connectingLabel: string;
  headphonesNote: string;
};

type Status = "idle" | "connecting" | "connected";

// Bypasses @elevenlabs/react ConversationProvider whose React state never
// syncs after startSession resolves (SDK issue #663, affects Chrome + Safari).
// We drive status manually from the client-level callbacks instead.
export function DiscoverySession({
  userId,
  studentName,
  nativeLanguage,
  firstMessageLocalized,
  startLabel,
  connectingLabel,
  headphonesNote,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const convRef = useRef<Conversation | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const start = async () => {
    setError(null);
    setStatus("connecting");
    console.info("[discovery] start clicked", { userId, nativeLanguage });

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (mErr) {
      console.error("[discovery] mic denied", mErr);
      setError("Microphone access denied. Please allow it and try again.");
      setStatus("idle");
      return;
    }

    let conversationToken: string;
    try {
      const r = await fetch("/api/convai/token");
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
      const j = (await r.json()) as { token?: string };
      if (!j.token) throw new Error("token missing in /api/convai/token response");
      conversationToken = j.token;
      console.info("[discovery] token fetched");
    } catch (tErr) {
      console.error("[discovery] token fetch failed", tErr);
      setError(
        `Failed to authorise session — ${tErr instanceof Error ? tErr.message : String(tErr)}`
      );
      setStatus("idle");
      return;
    }

    try {
      const conv = await Conversation.startSession({
        conversationToken,
        dynamicVariables: {
          user_id: userId,
          student_name: studentName ?? "",
          native_language: nativeLanguage,
          first_message_localized: firstMessageLocalized,
        },
        onConnect: () => {
          console.info("[discovery] connected");
          setStatus("connected");
          setError(null);
        },
        onDisconnect: () => {
          console.info("[discovery] disconnected");
          setStatus("idle");
          setIsSpeaking(false);
          convRef.current = null;
        },
        onError: (err: unknown) => {
          console.error("[discovery] error", err);
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setStatus("idle");
          convRef.current = null;
        },
        onModeChange: ({ mode }: { mode: string }) => {
          setIsSpeaking(mode === "speaking");
        },
      });
      convRef.current = conv;
      console.info("[discovery] startSession resolved");
    } catch (e) {
      console.error("[discovery] startSession threw", e);
      const detail =
        e instanceof Error
          ? `${e.name}: ${e.message}`
          : typeof e === "object" && e !== null
          ? JSON.stringify(e)
          : String(e);
      setError(`Failed to start session — ${detail}`);
      setStatus("idle");
    }
  };

  const stop = () => {
    void convRef.current?.endSession();
  };

  if (status === "connected") {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              isSpeaking ? "bg-coral animate-pulse" : "bg-ai-green"
            }`}
            aria-hidden
          />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            {isSpeaking ? "Aria is speaking" : "Listening..."}
          </span>
        </div>
        <button
          type="button"
          onClick={stop}
          className="rounded-md border border-coral/40 bg-coral/10 px-6 py-2.5 text-sm font-medium text-coral hover:bg-coral/15"
        >
          End session
        </button>
        <p className="max-w-md text-center text-xs text-mute">
          Speak naturally. There&apos;s nothing to type or click — Aria will guide
          you through six dimensions over about twenty minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {error && (
        <p className="max-w-md rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-center text-sm text-coral">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={!hydrated || status === "connecting"}
        className="rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep disabled:opacity-60"
      >
        {!hydrated || status === "connecting" ? connectingLabel : startLabel}
      </button>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute/70">
        status: {status}
      </p>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
        {headphonesNote}
      </p>
    </div>
  );
}
