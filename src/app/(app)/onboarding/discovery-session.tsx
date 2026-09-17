"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { ariaDiscoveryConfig } from "@/lib/onboarding/aria-discovery-config";

/**
 * Discovery voice session that ALSO binds identity server-side at connect
 * (POST /api/convai/bind), so the memory-loop tool routes and post-call webhook
 * resolve the learner from the convai_voice_bindings table rather than trusting
 * a client-supplied dynamic variable (VOICE_MEMORY_STANDARD rule 9).
 *
 * Mirrors @caistech/discovery-agent/react's two added behaviors the base widget
 * leaves to the consumer: staged re-grounding (sendContextualUpdate) and the
 * browser wrap-up timer + banner. Stage advancement is wired by the onboarding
 * flow; the intro stage is grounded immediately on connect.
 */

const DEFAULTS = { maxDurationSeconds: 1200, wrapWarningSeconds: 120 };

type DiscoverySessionState = {
  token: string;
  agentId: string;
  promptOverride?: string;
};

export function DiscoverySession() {
  const [session, setSession] = useState<DiscoverySessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrapUpVisible, setWrapUpVisible] = useState(false);
  const controlsRef = useRef<{ sendContextualUpdate: (text: string) => void } | null>(null);
  const wrapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = ariaDiscoveryConfig;
  const introStage = config.stages.find((s) => s.id === "intro") ?? config.stages[0] ?? null;
  const maxDuration = DEFAULTS.maxDurationSeconds;
  const wrapWarning = DEFAULTS.wrapWarningSeconds;

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const res = await fetch("/api/onboarding/discovery/session", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data?.error ?? "Failed to start discovery session.");
          return;
        }
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to start discovery session.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      if (wrapTimerRef.current) clearTimeout(wrapTimerRef.current);
    };
  }, []);

  // Staged re-grounding: push the intro stage's surface context so Aria opens
  // on-message. Deeper stage re-grounding is wired by the onboarding flow via
  // sendContextualUpdate once stage advancement is added; the intro grounding
  // covers the current onboarding arc.
  useEffect(() => {
    if (introStage && controlsRef.current) {
      controlsRef.current.sendContextualUpdate(
        `The user is at stage "${introStage.id}": ${introStage.goal}. ${introStage.context}`
      );
    }
    // Re-run on intro stage change; controls are read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introStage?.id]);

  const startWrapTimer = useCallback(() => {
    if (wrapTimerRef.current) clearTimeout(wrapTimerRef.current);
    const fireInMs = Math.max(0, (maxDuration - wrapWarning) * 1000);
    wrapTimerRef.current = setTimeout(() => {
      const minutes = Math.max(1, Math.round(wrapWarning / 60));
      controlsRef.current?.sendContextualUpdate(
        `The session is nearly at its time limit. Gently tell the user about ${minutes} ` +
          `minute${minutes === 1 ? "" : "s"} remain, and begin wrapping up.`
      );
      setWrapUpVisible(true);
    }, fireInMs);
  }, [maxDuration, wrapWarning]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!session) return <p>Connecting to Aria...</p>;

  const overrides = session.promptOverride
    ? { agent: { prompt: { prompt: session.promptOverride } } }
    : undefined;

  return (
    <div className="h-full w-full" data-discovery-agent={config.slug} data-stage={introStage?.id}>
      {wrapUpVisible && (
        <div
          role="status"
          data-discovery-wrapup
          className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800"
        >
          About {Math.max(1, Math.round(wrapWarning / 60))} min left — wrapping up.
        </div>
      )}
      <VoiceWidget
        agentId={session.agentId}
        // The signed token carries the on-session identity; the bind route and
        // webhook verify it server-side (never trusted bare client-side).
        userId={session.token}
        sessionId={session.token}
        mode="discovery"
        placement="inline"
        overrides={overrides}
        title={config.persona.name}
        coachName={config.persona.name}
        onReady={(controls) => {
          controlsRef.current = controls;
          if (introStage) {
            controls.sendContextualUpdate(
              `The user is starting at stage "${introStage.id}": ${introStage.goal}. ${introStage.context}`
            );
          }
        }}
        onConnect={(conversationId) => {
          // Server-side identity binding for the memory loop — the ElevenLabs
          // conversation id is written against THIS authenticated learner, so
          // the tool routes + post-call webhook resolve the real user.
          startWrapTimer();
          void fetch("/api/convai/bind", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId }),
          }).catch((err) => {
            console.error("[discovery] voice bind failed:", err);
          });
        }}
        onDisconnect={() => {
          window.location.href = "/onboarding/battery";
        }}
      />
    </div>
  );
}