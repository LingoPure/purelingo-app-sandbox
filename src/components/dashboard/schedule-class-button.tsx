"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClassInSandboxNotice } from "@/components/classin/classin-sandbox-notice";

export function ScheduleClassButton({ connected = false }: { connected?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  async function doSchedule() {
    setError(null);
    setScheduling(true);
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
      setNoticeOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setScheduling(false);
    }
  }

  function handleClick() {
    // In the sandbox, ClassIn isn't connected — flag it on usage before
    // creating the placeholder session. When connected, schedule directly.
    if (!connected) {
      setNoticeOpen(true);
      return;
    }
    void doSchedule();
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
      <ClassInSandboxNotice
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        onContinue={() => void doSchedule()}
        busy={scheduling}
      />
    </div>
  );
}
