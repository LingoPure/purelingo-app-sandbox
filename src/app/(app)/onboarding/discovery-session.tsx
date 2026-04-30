"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useState } from "react";

type Props = {
  agentId: string;
  userId: string;
  studentName?: string | null;
};

/**
 * @elevenlabs/react ≥1.3 splits state into a ConversationProvider + hooks.
 * `useConversation()` MUST be called inside a `<ConversationProvider>` —
 * the page component wraps the inner widget so the provider is mounted
 * exactly once around the SDK consumer.
 */
export function DiscoverySession(props: Props) {
  return (
    <ConversationProvider>
      <DiscoverySessionInner {...props} />
    </ConversationProvider>
  );
}

function DiscoverySessionInner({ agentId, userId, studentName }: Props) {
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setError(null),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    },
  });

  const start = async () => {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow it and try again.");
      return;
    }
    try {
      await conversation.startSession({
        agentId,
        dynamicVariables: {
          user_id: userId,
          student_name: studentName ?? "",
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start session");
    }
  };

  const stop = () => {
    void conversation.endSession();
  };

  const status = conversation.status;
  const isSpeaking = conversation.isSpeaking;

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
        disabled={status === "connecting"}
        className="rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep disabled:opacity-60"
      >
        {status === "connecting" ? "Connecting…" : "Start discovery session"}
      </button>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
        Plug in headphones · ~25 minutes · English only
      </p>
    </div>
  );
}
