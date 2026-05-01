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

  useEffect(() => {
    setHydrated(true);
  }, []);

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
    // tried it on this Start click. Used from BOTH onError and
    // onDisconnect — the SDK fires only one of these depending on
    // WHEN in the lifecycle the WebRTC connection dies, and we've
    // observed both in the wild. For onDisconnect we trigger on
    // reason === "error" alone (no message-text heuristic) because
    // that flag is the SDK's own signal that this isn't a clean
    // user- or agent-initiated disconnect.
    const triggerFallback = (logHint: string): boolean => {
      if (transport !== "webrtc" || triedWebSocketRef.current) return false;
      triedWebSocketRef.current = true;
      console.warn(
        "[discovery] webrtc failed, retrying on websocket transport",
        logHint
      );
      setError(
        "Voice connection blocked by your network — falling back to backup mode…"
      );
      setStatus("connecting");
      convRef.current = null;
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
        setStatus("connected");
        setError(null);
      },
      onDisconnect: (details: { reason: string; message?: string }) => {
        console.info("[discovery] disconnected", details);
        // SDK self-disconnect (WebRTC failure / reconnection exhausted).
        // This is the path we observed in prod — onError never fires;
        // the SDK quietly tears down the room and reports reason: "error"
        // here. Fallback even if onConnect briefly flickered earlier.
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
      return;
    }

    if (!j.token) throw new Error("token missing in token response");
    console.info("[discovery] token fetched (webrtc)");
    const conv = await Conversation.startSession({
      conversationToken: j.token,
      dynamicVariables,
      ...callbacks,
    });
    convRef.current = conv;
  };

  const start = async () => {
    setError(null);
    setStatus("connecting");
    triedWebSocketRef.current = false;
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
