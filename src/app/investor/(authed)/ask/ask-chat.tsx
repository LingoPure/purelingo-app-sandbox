"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "@/components/markdown-view";

type Citation = { documentId: string; displayName: string; page: number | null };
type Message = { role: "user" | "analyst"; text: string; citations?: Citation[] };

const SAMPLES = [
  "What is the cap table and ESOP allocation?",
  "Summarise the customer contracts and traction.",
  "What are the revenue projections for 2026–2029?",
];

export function AskChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/investor/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setMessages((m) => [
        ...m,
        { role: "analyst", text: data.answer, citations: data.citations },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-cream bg-paper p-4 sm:p-6">
            <p className="text-base text-navy/70">Try one of these, or ask your own:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="min-h-[44px] rounded-full border border-navy/15 px-4 py-2 text-left text-sm text-navy hover:border-gold hover:bg-gold/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "min-w-0 max-w-[85%] rounded-2xl bg-navy px-4 py-3 text-base text-paper"
                  : "min-w-0 max-w-[85%] space-y-3 rounded-2xl border border-cream bg-paper px-4 py-3 text-base text-navy"
              }
            >
              {m.role === "analyst" ? (
                <MarkdownView>{m.text}</MarkdownView>
              ) : (
                <p className="whitespace-pre-wrap">{m.text}</p>
              )}
              {m.role === "analyst" && m.citations && m.citations.length > 0 && (
                <div className="border-t border-cream pt-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">
                    Sources
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.citations.map((c) => (
                      <span
                        key={c.documentId}
                        className="rounded-md bg-mist px-2 py-1 text-xs text-navy/80"
                      >
                        {c.displayName}
                        {c.page ? ` · p.${c.page}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-cream bg-paper px-4 py-3 text-base text-navy/50">
              Reading the dataroom…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <form onSubmit={submit} className="sticky bottom-0 flex gap-2 bg-mist py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about LingoPure…"
          className="min-h-[44px] flex-1 rounded-xl border border-navy/15 bg-paper px-4 text-base text-navy outline-none focus:border-gold"
          disabled={loading}
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="min-h-[44px] rounded-xl bg-navy px-5 text-base font-medium text-paper disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
