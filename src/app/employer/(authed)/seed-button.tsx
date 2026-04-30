"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SeedButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/employer/seed", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        studentsCreated?: number;
        studentsUpdated?: number;
      };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setPending(false);
        return;
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-navy transition hover:bg-gold/20 disabled:opacity-50"
      >
        {pending ? "Seeding…" : done ? "Seeded ✓" : "Seed demo cohort"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
