"use client";

import { useState } from "react";

type Capability = { key: string; label: string; defaultSections: string[] };
type Citation = { documentId: string; displayName: string; page: number | null };
type ChatMsg = { role: "user" | "morgan"; text: string };
type RunResult = {
  reportId: string;
  title: string;
  markdown: string;
  citations: Citation[];
  format: "pdf" | "markdown";
  downloadUrl: string | null;
};

export function ReportsBuilder({ capabilities }: { capabilities: Capability[] }) {
  const [reportType, setReportType] = useState(capabilities[0].key);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [sectionsText, setSectionsText] = useState(capabilities[0].defaultSections.join("\n"));
  const [format, setFormat] = useState<"pdf" | "markdown">("pdf");

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyType(key: string) {
    setReportType(key);
    const cap = capabilities.find((c) => c.key === key);
    if (cap) setSectionsText(cap.defaultSections.join("\n"));
  }

  function currentSpec() {
    return {
      reportType,
      title: title.trim() || null,
      topic: topic.trim() || null,
      sections: sectionsText.split("\n").map((s) => s.trim()).filter(Boolean),
      format,
    };
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next = [...chat, { role: "user" as const, text }];
    setChat(next);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await fetch("/api/investor/reports/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Consultant unavailable");
      setChat((c) => [...c, { role: "morgan", text: data.reply }]);
      if (data.spec) {
        // Morgan resolved a spec — fill the form so the investor can review + run.
        setReportType(data.spec.reportType);
        setTitle(data.spec.title ?? "");
        setTopic(data.spec.topic ?? "");
        setSectionsText((data.spec.sections ?? []).join("\n"));
        setFormat(data.spec.format ?? "pdf");
      }
    } catch (err) {
      setChat((c) => [...c, { role: "morgan", text: err instanceof Error ? err.message : "Something went wrong." }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function generate() {
    setError(null);
    setResult(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/investor/reports/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec: currentSpec() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setResult(data);
      if (data.format === "pdf" && data.downloadUrl) window.open(data.downloadUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadMarkdown() {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sectionCount = sectionsText.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Door 1 — discovery chat (Morgan) */}
      <div className="flex flex-col rounded-2xl border border-cream bg-paper">
        <div className="border-b border-cream px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Reports consultant</p>
          <p className="text-sm text-navy/70">Describe the report you need — Morgan fills the form.</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ minHeight: 180, maxHeight: 320 }}>
          {chat.length === 0 && (
            <p className="text-sm text-navy/50">
              e.g. &ldquo;An investment memo&rdquo; · &ldquo;Due diligence on the customer contracts&rdquo; ·
              &ldquo;A financials brief focused on unit economics&rdquo;
            </p>
          )}
          {chat.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-navy px-3 py-2 text-sm text-paper"
                    : "max-w-[85%] rounded-2xl border border-cream bg-mist px-3 py-2 text-sm text-navy"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {chatBusy && <p className="text-sm text-navy/40">Morgan is thinking…</p>}
        </div>
        <form onSubmit={sendChat} className="flex gap-2 border-t border-cream p-3">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Describe the report…"
            disabled={chatBusy}
            className="min-h-[44px] flex-1 rounded-xl border border-navy/15 bg-paper px-3 text-base text-navy outline-none focus:border-gold"
            aria-label="Describe the report"
          />
          <button
            type="submit"
            disabled={chatBusy || !chatInput.trim()}
            className="min-h-[44px] rounded-xl bg-navy px-4 text-base font-medium text-paper disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>

      {/* Door 2 — building-block form */}
      <div className="space-y-4 rounded-2xl border border-cream bg-paper p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Build it yourself</p>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Report type</span>
          <select
            value={reportType}
            onChange={(e) => applyType(e.target.value)}
            className="min-h-[44px] rounded-md border border-cream bg-paper px-3 text-base text-navy focus:border-navy focus:outline-none"
          >
            {capabilities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Focus / topic (optional)</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. the DatumHQ contract, unit economics…"
            className="min-h-[44px] rounded-md border border-cream bg-paper px-3 text-base text-navy focus:border-navy focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Sections — one per line ({sectionCount})</span>
          <textarea
            value={sectionsText}
            onChange={(e) => setSectionsText(e.target.value)}
            rows={7}
            className="rounded-md border border-cream bg-paper px-3 py-2 text-base text-navy focus:border-navy focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "pdf" | "markdown")}
            className="min-h-[44px] rounded-md border border-cream bg-paper px-3 text-base text-navy focus:border-navy focus:outline-none"
          >
            <option value="pdf">Watermarked PDF</option>
            <option value="markdown">Markdown</option>
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={generating || sectionCount === 0}
          className="min-h-[44px] w-full rounded-md bg-navy px-4 text-base font-medium text-paper disabled:opacity-40"
        >
          {generating ? "Generating report…" : "Generate report"}
        </button>
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3 rounded-2xl border border-cream bg-paper p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif text-lg text-navy">{result.title}</h3>
            <div className="flex gap-2">
              {result.format === "pdf" && result.downloadUrl && (
                <a
                  href={result.downloadUrl}
                  target="_blank"
                  className="rounded-md border border-navy/20 px-3 py-2 text-sm text-navy hover:bg-mist"
                >
                  Open PDF
                </a>
              )}
              <button
                type="button"
                onClick={downloadMarkdown}
                className="rounded-md border border-navy/20 px-3 py-2 text-sm text-navy hover:bg-mist"
              >
                Download .md
              </button>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-mist p-4 text-sm leading-relaxed text-navy/90">
            {result.markdown}
          </div>
          {result.citations.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">Sources</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.citations.map((c) => (
                  <span key={c.documentId} className="rounded-md bg-mist px-2 py-1 text-xs text-navy/80">
                    {c.displayName}
                    {c.page ? ` · p.${c.page}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
