"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ScheduleClassButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      const res = await fetch("/api/classin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-cream bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-navy transition hover:bg-mist disabled:opacity-50"
      >
        {pending ? "Scheduling…" : "Schedule a demo class"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
