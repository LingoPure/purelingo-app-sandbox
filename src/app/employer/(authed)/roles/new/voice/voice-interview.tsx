"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";

type Session = {
  token: string;
  agentId: string;
  promptOverride?: string;
  roleId: string;
};

/**
 * Role-discovery voice interview — mirrors onboarding/discovery-session.tsx's
 * connect/bind/disconnect shape, adapted for an employer admin defining a
 * role instead of a student assessing themselves.
 *
 * Step 1: admin types the role name, starts the interview.
 * Step 2: VoiceWidget runs the call; /api/convai/bind ties the live
 *         ElevenLabs conversation to the admin's own authenticated session
 *         (never a client-asserted id — same mechanism every other voice
 *         agent in this app already uses).
 * Step 3: on disconnect, poll until the webhook has scored the transcript,
 *         then land on the role's edit page to review/tweak the result.
 */
export function VoiceInterview() {
  const router = useRouter();
  const [roleName, setRoleName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [ended, setEnded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsRef = useRef<{ sendContextualUpdate: (text: string) => void } | null>(null);

  function startInterview() {
    if (!roleName.trim()) {
      setError("Enter a role name first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/employer/roles/discovery/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleName: roleName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Could not start the interview.");
          return;
        }
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start the interview.");
      }
    });
  }

  useEffect(() => {
    if (!ended || !session) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/employer/roles/discovery/status?roleId=${encodeURIComponent(session.roleId)}`
        );
        const data = await res.json();
        if (data.complete) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.failed) {
            setError("The interview ended without a usable transcript — try again.");
          } else {
            router.push(`/employer/roles/${session.roleId}`);
          }
        }
      } catch {
        // Transient — keep polling.
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ended, session, router]);

  if (error) {
    return (
      <div className="rounded-lg border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
        {error}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-cream bg-paper p-6">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Role name
          </span>
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. BPO Business Development Manager"
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            disabled={starting}
          />
        </label>
        <button
          type="button"
          onClick={startInterview}
          disabled={starting || !roleName.trim()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-navy px-6 py-3 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-70"
        >
          {starting ? "Connecting to Aria…" : "Start the interview →"}
        </button>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="rounded-lg border border-cream bg-paper p-6 text-center text-sm text-mute">
        Scoring the interview and setting up the role's baselines — this takes a few seconds…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <VoiceWidget
        agentId={session.agentId}
        userId={session.token}
        sessionId={session.token}
        mode="discovery"
        placement="inline"
        overrides={
          session.promptOverride
            ? { agent: { prompt: { prompt: session.promptOverride } } }
            : undefined
        }
        title="Aria"
        coachName="Aria"
        avatarUrl="/kira-avatar.jpg"
        transcript
        onReady={(controls) => {
          controlsRef.current = controls;
        }}
        onConnect={(conversationId) => {
          void fetch("/api/convai/bind", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId }),
          }).catch((err) => {
            console.error("[role-discovery] voice bind failed:", err);
          });
        }}
        onDisconnect={() => {
          setEnded(true);
        }}
      />
    </div>
  );
}
