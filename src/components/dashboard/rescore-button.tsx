"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RescoreButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/scoring/discovery", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setDone(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-score failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-cream bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-navy transition hover:bg-mist disabled:opacity-50"
      >
        {pending ? "Re-scoring…" : done ? "Re-scored ✓" : "Re-score"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
