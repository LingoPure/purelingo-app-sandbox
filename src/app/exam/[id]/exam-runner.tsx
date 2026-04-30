"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExamRunner({
  certId,
  level,
}: {
  certId: string;
  level: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/certifications/${certId}/simulate`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setPending(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exam failed");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-50"
      >
        {pending ? "Running exam…" : `Run ${level} exam (demo)`}
      </button>
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}
