"use client";

import { useEffect, useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { SKILL_LABELS, type AnySkillKey } from "@/lib/scoring/rubric";

type SessionState = {
  token: string;
  agentId: string;
  promptOverride?: string;
  targetSkill: AnySkillKey;
};

/**
 * Lighter-weight sibling of DiscoverySession (src/app/(app)/onboarding/
 * discovery-session.tsx) — a short, single-purpose drill session, so no
 * stage-grounding and no wrap-up timer (discovery runs up to 20 minutes;
 * this is meant to be a few). Identity relies on the same signed-token
 * verification /api/plan/session uses, not an explicit bind step.
 */
export function VoiceTutorSession({
  requestedSkill,
  trigger,
}: {
  requestedSkill: AnySkillKey | null;
  trigger: "scheduled" | "on_demand";
}) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capInfo, setCapInfo] = useState<{ usedToday: number; cap: number } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const res = await fetch("/api/voice-tutor/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetSkill: requestedSkill ?? undefined, trigger }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 429) {
            setCapInfo({ usedToday: data.usedToday, cap: data.cap });
          }
          setError(data?.error ?? "Could not start a practice session.");
          return;
        }
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not start a practice session.");
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per mount
  }, []);

  if (done) {
    return (
      <div className="rounded-lg border border-cream bg-paper p-6 text-center">
        <p className="font-serif text-lg text-navy">Nice work.</p>
        <p className="mt-1 text-sm text-mute">
          That session is being reviewed — your score updates on the dashboard shortly.
        </p>
        <a
          href="/dashboard"
          className="mt-4 inline-block rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          Back to dashboard
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-coral/30 bg-coral/5 p-6 text-center">
        <p className="text-sm text-coral">{error}</p>
        {capInfo && (
          <p className="mt-1 text-xs text-mute">
            {capInfo.usedToday}/{capInfo.cap} practice sessions used today.
          </p>
        )}
      </div>
    );
  }

  if (!session) return <p className="text-sm text-mute">Connecting to Aria…</p>;

  const overrides = session.promptOverride
    ? { agent: { prompt: { prompt: session.promptOverride } } }
    : undefined;

  return (
    <div className="h-full w-full" data-voice-tutor-skill={session.targetSkill}>
      <VoiceWidget
        agentId={session.agentId}
        userId={session.token}
        sessionId={session.token}
        mode="discovery"
        placement="inline"
        overrides={overrides}
        title="Aria"
        coachName={`Aria — ${SKILL_LABELS[session.targetSkill]} drill`}
        avatarUrl="/kira-avatar.jpg"
        transcript
        onDisconnect={() => setDone(true)}
      />
    </div>
  );
}
