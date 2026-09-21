"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";

type PlanSession = {
  token: string;
  agentId: string;
  promptOverride?: string;
  firstMessage?: string;
};

/**
 * Plan delivery client — the "sit down with the client" conversation.
 *
 * Mirrors DiscoverySession's pattern: start a server-minted session
 * (identity bound server-side via /api/convai/bind on connect), mount the
 * VoiceWidget with the compiled plan prompt + first message, then record
 * commitment to the /api/plan/delivery endpoint.
 */
export function PlanDelivery() {
  const router = useRouter();
  const [session, setSession] = useState<PlanSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitState, setCommitState] = useState<
    "idle" | "committed" | "declined" | "saving" | "error"
  >("idle");
  const controlsRef = useRef<{
    sendContextualUpdate: (text: string) => void;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const res = await fetch("/api/plan/session", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data?.error ?? "Could not start plan session.");
          return;
        }
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not start plan session.");
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordCommitment = async (accepted: boolean, notes?: string) => {
    if (committing) return;
    setCommitting(true);
    setCommitState("saving");
    try {
      const res = await fetch("/api/plan/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted, notes }),
      });
      if (!res.ok) throw new Error("Failed to record commitment");
      setCommitState(accepted ? "committed" : "declined");
    } catch (err) {
      setCommitState("error");
      setError(err instanceof Error ? err.message : "Could not record commitment");
    } finally {
      setCommitting(false);
    }
  };

  const bookACall = async () => {
    // Record interest (best-effort — a failed write must never block getting
    // to the booking page) then take the student to /book-a-demo.
    await recordCommitment(true).catch(() => {});
    router.push("/book-a-demo");
  };

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {commitState === "committed" && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
        >
          ✓ Interest recorded — taking you to book a call.
        </div>
      )}
      {commitState === "declined" && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800"
        >
          No problem — your sample programme stays available on your dashboard
          whenever you want to revisit it.
        </div>
      )}

      {!session ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Connecting to Aria…
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <VoiceWidget
            agentId={session.agentId}
            userId={session.token}
            sessionId={session.token}
            mode="discovery"
            placement="inline"
            overrides={
              session.promptOverride
                ? {
                    agent: {
                      prompt: { prompt: session.promptOverride },
                      firstMessage: session.firstMessage,
                    },
                  }
                : undefined
            }
            title="Aria"
            coachName="Aria"
            avatarUrl="/kira-avatar.jpg"
            transcript
            onReady={(controls) => {
              controlsRef.current = controls;
              controls.sendContextualUpdate(
                "The student has just completed their assessment. You are presenting a free sample programme and inviting them to book a call if they're interested — this is not an enrolment and you should not ask for a commitment. Do not re-run the assessment."
              );
            }}
            onDisconnect={() => {
              // Conversation ended — the on-screen commitment buttons remain
              // available so the student confirms after talking it through.
            }}
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={bookACall}
          disabled={committing || !session}
          className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {committing ? "Saving…" : "Book a call"}
        </button>
        <button
          type="button"
          onClick={() => recordCommitment(false)}
          disabled={committing || !session}
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Not right now
        </button>
      </div>
    </div>
  );
}