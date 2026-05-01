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
type Transport = "webrtc" | "websocket";

// Strings the SDK / underlying livekit-client surface when WebRTC media
// negotiation fails — typically because the user's network is blocking
// UDP/STUN/TURN. When we see one of these, we silently retry the session
// over the WebSocket transport, which only needs a single TLS:443 socket
// and survives almost any firewall.
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

/**
 * Map raw SDK error messages to user-readable copy. The default SDK
 * message ("NegotiationError: negotiation timed out") is opaque and
 * indistinguishable from a real bug; users on restrictive networks need
 * to know the problem is environmental, not the app.
 */
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

// Bypasses @elevenlabs/react ConversationProvider whose React state never
// syncs after startSession resolves (SDK issue #663, affects Chrome + Safari).
// We drive status manually from the client-level callbacks instead.
//
// On top of that workaround we also automatically fall back from WebRTC to
// the WebSocket transport when negotiation fails (UDP/STUN/TURN blocked,
// ICE timeout, or media-plane subscribe times out). The WS path is a
// single TLS:443 socket and survives almost any firewall.
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

  // Per-Start budget: try webrtc → fall back to ws once. Reset on each
  // click of Start so a fresh attempt gets a fresh budget.
  const triedWebSocketRef = useRef(false);
  // Tracks whether THIS attempt has reached onConnect. Used by the
  // stuck-in-connecting watchdog to decide whether to force a fallback.
  const attemptConnectedRef = useRef(false);
  // Pending watchdog timer for the current attempt; cleared on connect,
  // disconnect, error, or stop.
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHydrated(true);
    return () => {
      clearWatchdog();
    };
  }, []);

  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

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

    // Schedules a switch to the WS transport if we haven't already
    // tried it on this Start click. Used from THREE places:
    //   - onError (early failure, message matches WebRTC heuristics)
    //   - onDisconnect (SDK reports reason: "error")
    //   - watchdog (SDK is stuck — onConnect didn't fire within 12s)
    // The watchdog is the critical path: when the LiveKit server
    // can't subscribe to the local track (UDP blocked), the SDK
    // hangs without calling any callback. Without the watchdog the
    // user sees "Connecting…" forever.
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
      // Best-effort cleanup: tell the stuck SDK to give up so it
      // doesn't keep trying in the background.
      try {
        void convRef.current?.endSession();
      } catch {
        /* SDK may be in a weird state — ignore */
      }
      convRef.current = null;
      attemptConnectedRef.current = false;
      setTimeout(() => {
        startWithTransport("websocket").catch((retryErr) => {
          const retryMsg =
            retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.error("[discovery] websocket fallback failed", retryErr);
          setError(friendlyError(retryMsg));
          setStatus("idle");
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
        // SDK self-disconnect (WebRTC failure / reconnection exhausted).
        // The SDK reports reason: "error" — fall back even if onConnect
        // briefly flickered earlier.
        if (details?.reason === "error") {
          if (triggerFallback(details.message ?? "disconnect:error")) return;
        }

        // Normal disconnect (user clicked End, agent ended, or fallback
        // already ran)
        setStatus("idle");
        setIsSpeaking(false);
        convRef.current = null;
      },
      onError: (err: unknown) => {
        console.error("[discovery] error", err);
        clearWatchdog();
        const msg = err instanceof Error ? err.message : String(err);
        if (looksLikeWebRTCFailure(msg) && triggerFallback(msg)) return;

        setError(friendlyError(msg));
        setStatus("idle");
        convRef.current = null;
      },
      onModeChange: ({ mode }: { mode: string }) => {
        setIsSpeaking(mode === "speaking");
      },
    };

    // Arm the stuck-in-connecting watchdog before we kick off the
    // session. Only WebRTC attempts get a watchdog — WS connections
    // either succeed within 1-2s or fail with a real error.
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
      // Backstop: once startSession's Promise resolves we have a live
      // Conversation object — the room connection is established at
      // the SDK level. If onConnect doesn't fire (we've seen this on
      // Chrome / Safari, SDK issue #663), the React UI would otherwise
      // stay in "connecting" forever and the user would have no End
      // button. Force the state forward here.
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
    // If the watchdog already triggered WS fallback while this Promise
    // was hanging, discard this stale resolution — the WS attempt owns
    // the UI state now.
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
    triedWebSocketRef.current = false;
    attemptConnectedRef.current = false;
    clearWatchdog();
    console.info("[discovery] start clicked", { userId, nativeLanguage });

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (mErr) {
      console.error("[discovery] mic denied", mErr);
      setError("Microphone access denied. Please allow it and try again.");
      setStatus("idle");
      return;
    }

    try {
      await startWithTransport("webrtc");
      console.info("[discovery] startSession resolved");
    } catch (e) {
      console.error("[discovery] startSession threw", e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(friendlyError(detail));
      setStatus("idle");
    }
  };

  const stop = () => {
    console.info("[discovery] stop clicked");
    clearWatchdog();
    // Best-effort: tell the SDK to close. May be null if we're stopping
    // mid-connect (SDK hasn't returned a Conversation yet) — that's OK,
    // we still want to reset the UI immediately.
    try {
      void convRef.current?.endSession();
    } catch {
      /* ignore */
    }
    convRef.current = null;
    attemptConnectedRef.current = false;
    triedWebSocketRef.current = false;
    setStatus("idle");
    setIsSpeaking(false);
    setError(null);
  };

  // Show the End button as soon as ANY session is in flight — even
  // during "connecting", because we've seen the SDK get into states
  // where the connection is actually live but onConnect never fires
  // and React state stays stuck at "connecting". Without this, the
  // user can hear Aria but has no way to stop her.
  if (status !== "idle") {
    const showSpeakingIndicator = status === "connected";
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              status === "connecting"
                ? "bg-gold animate-pulse"
                : isSpeaking
                ? "bg-coral animate-pulse"
                : "bg-ai-green"
            }`}
            aria-hidden
          />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            {status === "connecting"
              ? "Connecting..."
              : showSpeakingIndicator && isSpeaking
              ? "Aria is speaking"
              : "Listening..."}
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
        disabled={!hydrated}
        className="rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep disabled:opacity-60"
      >
        {hydrated ? startLabel : connectingLabel}
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
