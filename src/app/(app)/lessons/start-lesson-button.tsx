"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartLessonButton({ type = "email_sprint" }: { type?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
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
      router.push(`/lessons/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start lesson");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-block self-start rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-50"
      >
        {pending
          ? "Generating prompt…"
          : type === "speak_score"
          ? "Start a speak & score →"
          : "Start an email sprint →"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
