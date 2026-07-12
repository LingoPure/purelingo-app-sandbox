"use client";

import { useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { MarkdownView } from "@/components/markdown-view";
import { Citations, type Citation } from "@/components/investor/citations";

/**
 * Voice Morgan — the investor dataroom voice clarifier, wired to the written
 * analyst (the auto-handoff) plus two voice-surface actions: find/open a document
 * and generate a report from the conversation.
 *
 * Confidentiality (the deliberate guardrail, surfaced to investors + the team):
 * Morgan (the spoken channel) only CLARIFIES — she never reads or fetches
 * documents, because the voice tool channel can't enforce the NDA tier. Every
 * data action below runs in THIS authenticated browser against the existing
 * tier/NDA-gated endpoints (/api/investor/ask, /documents, /reports/run), which
 * re-check the investor's tier server-side, gate deep-dive behind the NDA,
 * watermark per-investor, and audit. Answers/reports/documents are only ever
 * what the investor is already cleared to see.
 */

type Answer = { question: string; text: string; citations: Citation[] };
type DocItem = {
  id: string;
  display_name: string;
  category: string;
  confidentiality_tier: string;
  format: string;
};
type Turn = { role: "user" | "assistant"; content: string };
type GenReport = { title: string; downloadUrl: string | null };

export function InvestorVoiceMorgan({
  agentId,
  userId,
  welcomeBack,
  sessionPrompt,
}: {
  agentId: string;
  userId: string;
  welcomeBack: string | null;
  sessionPrompt: string | null;
}) {
  // Investor questions captured from the live call (their spoken turns) become
  // one-tap candidates; the full transcript feeds the report generator.
  const [questions, setQuestions] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // Document finder.
  const [docsOpen, setDocsOpen] = useState(false);
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docQuery, setDocQuery] = useState("");

  // Report generator.
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<GenReport | null>(null);
  const [reportNote, setReportNote] = useState<string | null>(null);
  const [reportErr, setReportErr] = useState<string | null>(null);

  function captureTurn(role: string, text: string) {
    const content = text.trim();
    if (!content) return;
    const turn: Turn = { role: role === "user" ? "user" : "assistant", content };
    setTranscript((prev) => [...prev, turn]);
    // The investor's own substantive turns become one-tap analyst candidates.
    if (turn.role === "user" && content.length >= 12) {
      setQuestions((prev) => (prev.includes(content) ? prev : [content, ...prev].slice(0, 6)));
    }
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

  async function copyAnswer(a: Answer, i: number) {
    const sources = a.citations.length
      ? "\n\nSources:\n" +
        a.citations
          .map((c) => `- ${c.displayName}${c.page ? ` (p.${c.page})` : ""}`)
          .join("\n")
      : "";
    try {
      await navigator.clipboard.writeText(`Q: ${a.question}\n\n${a.text}${sources}`);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  async function toggleDocs() {
    const next = !docsOpen;
    setDocsOpen(next);
    if (next && docs === null && !docsLoading) {
      setDocsLoading(true);
      try {
        const res = await fetch("/api/investor/documents");
        const data = await res.json();
        setDocs(res.ok ? (data.documents ?? []) : []);
      } catch {
        setDocs([]);
      } finally {
        setDocsLoading(false);
      }
    }
  }

  async function generateReport() {
    if (reportLoading) return;
    setReportErr(null);
    setReportNote(null);
    setReport(null);
    setReportLoading(true);
    try {
      // Hand the conversation to the report consultant; nudge it to commit to the
      // most relevant report rather than keep clarifying.
      const messages = [
        ...transcript.slice(-38),
        {
          role: "user" as const,
          content:
            "Based on our conversation, choose the single most relevant report and produce its spec now.",
        },
      ];
      const v = await fetch("/api/investor/reports/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const vd = await v.json();
      if (!v.ok) throw new Error(vd?.error ?? `Request failed (${v.status})`);
      if (!vd.spec) {
        setReportNote(
          (vd.reply || "Tell Morgan which report you'd like, then try again.") +
            " You can also build one on the Reports page."
        );
        return;
      }
      const r = await fetch("/api/investor/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec: vd.spec }),
      });
      const rd = await r.json();
      if (!r.ok) throw new Error(rd?.error ?? `Request failed (${r.status})`);
      setReport({ title: rd.title ?? "Report", downloadUrl: rd.downloadUrl ?? null });
    } catch (err) {
      setReportErr(err instanceof Error ? err.message : "Could not generate the report.");
    } finally {
      setReportLoading(false);
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

  const filteredDocs = (docs ?? []).filter((d) =>
    d.display_name.toLowerCase().includes(docQuery.trim().toLowerCase())
  );
  const section = "space-y-3 rounded-2xl border border-cream bg-paper p-4 sm:p-6";
  const chip =
    "min-h-[44px] max-w-full rounded-full border border-navy/15 px-4 py-2 text-left text-sm text-navy hover:border-gold hover:bg-gold/5 disabled:opacity-40";

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
          title="Talk it through with Morgan. Tell her, in your own words, what you're evaluating — she helps you turn a broad interest into a specific question. When you've shaped it, send it to the analyst below for a cited answer, open the source documents, or generate a report."
          overrides={
            welcomeBack || sessionPrompt
              ? {
                  agent: {
                    // Returning-investor recall: the composed prompt (base persona
                    // + what Morgan remembers about this investor) and a welcome-
                    // back opener. Both are omitted for a first-timer, leaving the
                    // provisioned base prompt + default greeting untouched.
                    ...(sessionPrompt ? { prompt: { prompt: sessionPrompt } } : {}),
                    ...(welcomeBack ? { firstMessage: welcomeBack } : {}),
                  },
                }
              : undefined
          }
          onMessage={captureTurn}
          onConnect={(conversationId) => {
            fetch("/api/investor/voice/bind", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ conversationId }),
            }).catch(() => {});
          }}
        />
      </div>

      {/* The auto-handoff: shape with Morgan → answer from the written analyst */}
      <div className={section}>
        <div>
          <h2 className="font-serif text-lg text-navy">Get the analyst&apos;s answer</h2>
          <p className="mt-1 text-sm text-navy/70">
            Morgan helps you <span className="font-medium">shape</span> the question; the{" "}
            <span className="font-medium">answer</span> comes from the written
            analyst — as text with its sources, not spoken. That&apos;s deliberate:{" "}
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
                  className={chip}
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

        {/* Per-answer cards */}
        {answers.map((a, i) => (
          <article
            key={i}
            className="min-w-0 space-y-3 rounded-xl border border-cream bg-mist/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">
                  Your question
                </p>
                <p className="mt-0.5 text-sm font-medium text-navy">{a.question}</p>
              </div>
              <button
                type="button"
                onClick={() => copyAnswer(a, i)}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-navy/20 px-3 text-xs font-medium text-navy hover:bg-mist"
              >
                {copied === i ? "Copied" : "Copy"}
              </button>
            </div>
            <MarkdownView>{a.text}</MarkdownView>
            <Citations citations={a.citations} />
          </article>
        ))}
      </div>

      {/* Find a document */}
      <div className={section}>
        <button
          type="button"
          onClick={toggleDocs}
          aria-expanded={docsOpen}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block font-serif text-lg text-navy">Find a document</span>
            <span className="mt-0.5 block text-sm text-navy/70">
              Open any file you&apos;re cleared for — watermarked + access-logged; deep-dive
              stays behind the NDA.
            </span>
          </span>
          <span className="shrink-0 text-navy/50">{docsOpen ? "–" : "+"}</span>
        </button>

        {docsOpen && (
          <div className="space-y-3">
            <input
              value={docQuery}
              onChange={(e) => setDocQuery(e.target.value)}
              placeholder="Search by document name…"
              className="min-h-[44px] w-full rounded-xl border border-navy/15 bg-paper px-4 text-base text-navy outline-none focus:border-gold"
              aria-label="Search documents"
            />
            {docsLoading ? (
              <p className="text-sm text-navy/50">Loading the dataroom…</p>
            ) : filteredDocs.length === 0 ? (
              <p className="text-sm text-navy/50">
                {docs && docs.length === 0 ? "No documents available." : "No matches."}
              </p>
            ) : (
              <ul className="divide-y divide-cream overflow-hidden rounded-xl border border-cream">
                {filteredDocs.slice(0, 12).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 bg-paper px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-navy">{d.display_name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-navy/40">
                        {d.format}
                        {d.confidentiality_tier === "restricted" ? " · deep dive" : ""}
                      </p>
                    </div>
                    <a
                      href={`/api/investor/documents/${d.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-navy/20 px-4 text-sm text-navy hover:bg-mist"
                    >
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {docs && filteredDocs.length > 12 && (
              <p className="text-xs text-navy/50">
                Showing 12 of {filteredDocs.length} — refine your search, or use the Documents
                page for the full list.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Generate a report from the conversation */}
      <div className={section}>
        <div>
          <h2 className="font-serif text-lg text-navy">Generate a report</h2>
          <p className="mt-1 text-sm text-navy/70">
            Turn your conversation with Morgan into a written report, drawn from the
            documents you&apos;re cleared for and delivered as a watermarked PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={generateReport}
          disabled={reportLoading || transcript.length === 0}
          className="min-h-[44px] rounded-xl bg-navy px-5 text-base font-medium text-paper disabled:opacity-40"
        >
          {reportLoading ? "Generating…" : "Generate a report from this conversation"}
        </button>
        {transcript.length === 0 && (
          <p className="text-xs text-navy/50">
            Have a conversation with Morgan first, then generate.
          </p>
        )}
        {reportErr && <p className="text-sm text-coral">{reportErr}</p>}
        {reportNote && <p className="text-sm text-navy/70">{reportNote}</p>}
        {report && (
          <div className="space-y-2 rounded-xl border border-teal/30 bg-teal/10 p-4">
            <p className="text-sm font-medium text-navy">{report.title} — ready.</p>
            <div className="flex flex-wrap gap-2">
              {report.downloadUrl && (
                <a
                  href={report.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center rounded-md bg-navy px-4 text-sm font-medium text-paper hover:bg-navy-deep"
                >
                  Download PDF
                </a>
              )}
              <a
                href="/investor/reports"
                className="inline-flex min-h-[44px] items-center rounded-md border border-navy/20 px-4 text-sm font-medium text-navy hover:bg-mist"
              >
                View in Reports
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
