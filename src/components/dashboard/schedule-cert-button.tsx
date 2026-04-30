"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScheduleCertButton({ level }: { level: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !body.id) {
        setError(body.error ?? `HTTP ${res.status}`);
        setPending(false);
        return;
      }
      router.push(`/exam/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-50"
      >
        {pending ? "Scheduling…" : `Schedule ${level} exam →`}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
