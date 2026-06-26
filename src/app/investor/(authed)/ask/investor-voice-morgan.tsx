"use client";

import { useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { MarkdownView } from "@/components/markdown-view";
import { Citations, type Citation } from "@/components/investor/citations";

/**
 * Voice Morgan — the investor dataroom voice clarifier, wired to the written
 * analyst (the auto-handoff). Morgan helps the investor shape what they want;
 * the actual answer is run through the authenticated, tier/NDA-gated text RAG
 * (/api/investor/ask) and rendered inline, with sources — so the spoken channel
 * never has to emit tier-gated content.
 *
 * Why the handoff (the deliberate guardrail, surfaced to investors + the team):
 * the dataroom holds contracts, the cap table and board materials across a main
 * tier and an NDA-gated deep dive. The written analyst enforces that access
 * control server-side and answers only from documents the investor is cleared
 * to see, and every question + answer is logged. Voice shapes the question; the
 * answer comes back as cited text, inside those guardrails.
 */

type Answer = { question: string; text: string; citations: Citation[] };

export function InvestorVoiceMorgan({
  agentId,
  userId,
  welcomeBack,
}: {
  agentId: string;
  userId: string;
  welcomeBack: string | null;
}) {
  // Investor questions captured from the live call (their spoken turns) become
  // one-tap candidates to send to the analyst. They can also edit/type their own.
  const [questions, setQuestions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function captureTurn(role: string, text: string) {
    // Only the investor's own turns are candidate questions; keep recent, deduped,
    // and substantive (a real question, not "yeah" / "okay").
    if (role !== "user") return;
    const q = text.trim();
    if (q.length < 12) return;
    setQuestions((prev) => (prev.includes(q) ? prev : [q, ...prev].slice(0, 6)));
  }

  async function askAnalyst(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/investor/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setAnswers((prev) => [
        { question: q, text: data.answer, citations: data.citations ?? [] },
        ...prev,
      ]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!agentId) {
    return (
      <div className="rounded-2xl border border-cream bg-paper p-4 text-base text-navy/70 sm:p-6">
        Morgan, the voice guide, isn&apos;t available right now — use the text
        Ask instead; it gives the same cited answers.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* The voice clarifier. overflow-x-clip contains the embedded convai panel,
          which can render a few px past a 375px viewport (naive-tester §1). */}
      <div className="overflow-x-clip rounded-2xl border border-cream bg-paper p-4 sm:p-6">
        <VoiceWidget
          agentId={agentId}
          userId={userId}
          placement="fullpage"
          mode="discovery"
          transcript
          textFallback
          avatarUrl="/female_avatar.jpeg"
          coachName="Morgan"
          title="Talk it through with Morgan. Tell her, in your own words, what you're evaluating — she helps you turn a broad interest into a specific question. When you've shaped it, send it to the analyst below for a cited answer."
          overrides={
            welcomeBack ? { agent: { firstMessage: welcomeBack } } : undefined
          }
          onMessage={captureTurn}
          onConnect={(conversationId) => {
            // Server-trusted binding so the post-call webhook labels this call's
            // memory against THIS investor (never the client dynamic var).
            fetch("/api/investor/voice/bind", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ conversationId }),
            }).catch(() => {});
          }}
        />
      </div>

      {/* The auto-handoff: shape with Morgan → answer from the written analyst */}
      <div className="space-y-3 rounded-2xl border border-cream bg-paper p-4 sm:p-6">
        <div>
          <h2 className="font-serif text-lg text-navy">Get the analyst&apos;s answer</h2>
          <p className="mt-1 text-sm text-navy/70">
            Morgan helps you <span className="font-medium">shape</span> the question; the{" "}
            <span className="font-medium">answer</span> comes from the written
            analyst — and it appears here as text with its sources, not spoken.
            That&apos;s deliberate:{" "}
            <span className="text-navy">
              the dataroom holds confidential material across a main tier and an
              NDA-gated deep dive, so every question runs through the same
              access-controlled, audited path and is answered only from documents
              you&apos;re cleared to see.
            </span>{" "}
            Voice never bypasses that guardrail.
          </p>
        </div>

        {questions.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">
              From your conversation — tap to ask the analyst
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askAnalyst(q)}
                  disabled={loading}
                  className="min-h-[44px] max-w-full rounded-full border border-navy/15 px-4 py-2 text-left text-sm text-navy hover:border-gold hover:bg-gold/5 disabled:opacity-40"
                >
                  {q.length > 90 ? `${q.slice(0, 90)}…` : q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askAnalyst(draft);
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Or type the question you and Morgan landed on…"
            className="min-h-[44px] flex-1 rounded-xl border border-navy/15 bg-paper px-4 text-base text-navy outline-none focus:border-gold"
            disabled={loading}
            aria-label="Question for the analyst"
          />
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            className="min-h-[44px] rounded-xl bg-navy px-5 text-base font-medium text-paper disabled:opacity-40"
          >
            {loading ? "Asking…" : "Get cited answer"}
          </button>
        </form>

        {error && <p className="text-sm text-coral">{error}</p>}

        {answers.map((a, i) => (
          <div key={i} className="min-w-0 space-y-3 rounded-xl border border-cream bg-mist/40 p-4">
            <p className="text-sm font-medium text-navy/60">{a.question}</p>
            <MarkdownView>{a.text}</MarkdownView>
            <Citations citations={a.citations} />
          </div>
        ))}
      </div>
    </div>
  );
}
