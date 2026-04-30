"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Renders the ClassIn iframe and listens for the SDK's session-end postMessage.
 *
 * The SDK fires a postMessage with shape { type: "classin:session-end", duration_secs }
 * (exact shape TBC from EEO docs). When seen, we POST to /api/classin/session-end
 * which marks the row complete and (Step 7b) queues post-session sync.
 */

type Props = {
  sessionId: string;
  embedUrl: string;
  teacherName: string | null;
};

type SessionEndMessage = {
  type: "classin:session-end";
  duration_secs?: number;
};

function isSessionEnd(data: unknown): data is SessionEndMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type: unknown }).type === "classin:session-end"
  );
}

export function ClassroomFrame({ sessionId, embedUrl, teacherName }: Props) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (!isSessionEnd(event.data)) return;
      setEnding(true);
      fetch("/api/classin/session-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          duration_secs: event.data.duration_secs,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          router.push("/dashboard");
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to end session");
          setEnding(false);
        });
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, router]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-paper/10 px-4 py-2">
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-paper"
        >
          ← Leave classroom
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          {teacherName ? `With ${teacherName}` : "Live class"}
        </span>
      </header>
      <iframe
        src={embedUrl}
        title="ClassIn classroom"
        className="flex-1 border-0 bg-paper"
        allow="camera; microphone; display-capture; fullscreen; autoplay"
      />
      {ending && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/85 backdrop-blur">
          <p className="font-serif text-xl text-paper">
            Session ended — saving...
          </p>
        </div>
      )}
      {error && (
        <div className="border-t border-coral/40 bg-coral/10 px-4 py-2 text-sm text-coral">
          {error} — close the tab manually if the dashboard does not reload.
        </div>
      )}
    </>
  );
}
