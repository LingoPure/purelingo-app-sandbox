"use client";

import { useState, useEffect } from "react";
import { DiscoveryWidget } from "@caistech/discovery-agent/react";
import { ariaDiscoveryConfig } from "@/lib/onboarding/aria-discovery-config";

export function DiscoverySession({ userId }: { userId: string }) {
  const [session, setSession] = useState<{ token: string; agentId: string; promptOverride?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState("intro");

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
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (!session) return <p>Connecting to Aria...</p>;

  return (
    <div className="h-full w-full">
      <DiscoveryWidget 
        config={ariaDiscoveryConfig} 
        session={session} 
        activeStageId={activeStageId} 
        onEnd={() => window.location.href = "/onboarding/battery"}
        onStageComplete={(stageId: string) => setActiveStageId(stageId)}
      />
    </div>
  );
}
