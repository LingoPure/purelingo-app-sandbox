"use client";

import { useState, useEffect } from "react";
import { DiscoveryWidget } from "@caistech/discovery-agent/react";
import { ariaDiscovery } from "@/lib/onboarding/aria-discovery";

export function DiscoverySession({ userId }: { userId: string }) {
  const [session, setSession] = useState<{ token: string; agentId: string; promptOverride?: string } | null>(null);
  const [activeStageId, setActiveStageId] = useState("intro");

  useEffect(() => {
    async function start() {
      const res = await fetch("/api/onboarding/discovery/session", { method: "POST" });
      const data = await res.json();
      setSession(data);
    }
    void start();
  }, []);

  if (!session) return <p>Connecting to Aria...</p>;

  return (
    <div className="h-full w-full">
      <DiscoveryWidget 
        config={ariaDiscovery.config} 
        session={session} 
        activeStageId={activeStageId} 
        onEnd={() => window.location.href = "/onboarding/battery"}
        onStageComplete={(stageId: string) => setActiveStageId(stageId)}
      />
    </div>
  );
}
