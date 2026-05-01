"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ChatTurn = { role: "assistant" | "user"; content: string };
type ChatStep = {
  next_message: string;
  ready_to_finalize: boolean;
  open_questions: string[];
};

export function DiscoverChat() {
  const router = useRouter();
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [step, setStep] = useState<ChatStep | null>(null);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Kick off — fetch the canned first message so the chat lands populated.
  useEffect(() => {
    if (history.length > 0 || step) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/employer/roles/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: [] }),
        });
        const data: { firstMessage?: string; step?: ChatStep; error?: string } =
          await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.step) {
          setError(data.error ?? `Failed to start (${res.status})`);
          return;
        }
        setStep(data.step);
        setHistory([{ role: "assistant", content: data.step.next_message }]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to start");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [history.length, step]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setError(null);
    const nextHistory: ChatTurn[] = [
      ...history,
      { role: "user", content: text },
    ];
    setHistory(nextHistory);
    setInput("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/employer/roles/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: nextHistory }),
        });
        const data: { step?: ChatStep; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (!res.ok || !data.step) {
          setError(data.error ?? `Agent error (${res.status})`);
          return;
        }
        setStep(data.step);
        setHistory((h) => [
          ...h,
          { role: "assistant", content: data.step!.next_message },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Agent call failed");
      }
    });
  }

  function onFinalize() {
    // Stash the transcript in sessionStorage — the review page reads it
    // and calls the finalizer. URL params would clip on long interviews.
    try {
      sessionStorage.setItem(
        "lp_role_discovery_history",
        JSON.stringify(history)
      );
    } catch {
      setError("Browser storage unavailable — try a different browser.");
      return;
    }
    router.push("/employer/roles/new/discover/review");
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isPending) send();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={scrollRef}
        className="flex max-h-[60vh] min-h-[40vh] flex-col gap-3 overflow-y-auto rounded-lg border border-cream bg-paper p-5"
      >
        {history.length === 0 && !error && (
          <p className="text-sm text-mute">Connecting to the consultant…</p>
        )}
        {history.map((turn, i) => (
          <Bubble key={i} role={turn.role}>
            {turn.content}
          </Bubble>
        ))}
        {isPending && (
          <Bubble role="assistant">
            <span className="text-mute">…</span>
          </Bubble>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      {step?.ready_to_finalize ? (
        <div className="flex flex-col gap-3 rounded-lg border border-teal/30 bg-teal/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
            Ready to generate
          </p>
          <p className="text-sm text-ink">
            The consultant has enough to draft a role profile. Review and
            edit on the next screen before saving.
          </p>
          <div>
            <button
              type="button"
              onClick={onFinalize}
              className="rounded-full bg-navy px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90"
            >
              Generate role profile →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-cream bg-paper p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={3}
            placeholder="Type your answer… (Enter to send, Shift+Enter for newline)"
            disabled={isPending || history.length === 0}
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
              {step?.open_questions?.length
                ? `Still to cover: ${step.open_questions.length}`
                : ""}
            </p>
            <button
              type="button"
              onClick={send}
              disabled={isPending || !input.trim()}
              className="rounded-full bg-navy px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "assistant" | "user";
  children: React.ReactNode;
}) {
  const isAssistant = role === "assistant";
  return (
    <div className={isAssistant ? "flex justify-start" : "flex justify-end"}>
      <div
        className={
          isAssistant
            ? "max-w-[80%] rounded-2xl rounded-bl-sm bg-mist/50 px-4 py-2 text-sm leading-relaxed text-ink"
            : "max-w-[80%] rounded-2xl rounded-br-sm bg-navy px-4 py-2 text-sm leading-relaxed text-paper"
        }
      >
        {children}
      </div>
    </div>
  );
}
