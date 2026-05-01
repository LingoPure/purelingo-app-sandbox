"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ParseError = { rowNumber: number; raw: string; error: string };
type ImportRowOutcome = {
  rowNumber: number;
  email: string;
  status: "created" | "updated" | "error";
  message?: string;
};
type ImportResponse = {
  ok: true;
  parseErrors: ParseError[];
  parsedCount: number;
  import: {
    attempted: number;
    created: number;
    updated: number;
    errors: number;
    outcomes: ImportRowOutcome[];
  };
};

const SAMPLE = `name,email,role,target_level
Nguyen Thi Hoa,hoa.nguyen@acme-pacific.demo,BPO Operator,B2
Tran Van Minh,minh.tran@acme-pacific.demo,Manufacturing Sales Rep,C1`;

export function ImportClient({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ImportResponse | null>(null);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text =
        typeof reader.result === "string"
          ? reader.result
          : new TextDecoder().decode(reader.result as ArrayBuffer);
      setCsv(text);
    };
    reader.readAsText(file);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResponse(null);
    if (!csv.trim()) {
      setError("Paste a CSV or pick a file first.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/employer/staff/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data: ImportResponse | { error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !("ok" in data)) {
        setError(("error" in data && data.error) || `Import failed (${res.status})`);
        return;
      }
      setResponse(data);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            CSV input
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCsv(SAMPLE)}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
              disabled={disabled || isPending}
            >
              Insert sample
            </button>
            <label className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline">
              Upload file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
                disabled={disabled || isPending}
              />
            </label>
          </div>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={12}
          placeholder="name,email,role,target_level"
          className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 font-mono text-xs text-ink focus:border-navy focus:outline-none"
          disabled={disabled || isPending}
        />
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={disabled || isPending || !csv.trim()}
          className="rounded-full bg-navy px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:opacity-50"
        >
          {isPending ? "Importing…" : "Import staff"}
        </button>
      </div>

      {response && <ImportReport response={response} />}
    </form>
  );
}

function ImportReport({ response }: { response: ImportResponse }) {
  const { parseErrors, parsedCount, import: imp } = response;
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Parsed" value={parsedCount} />
        <Stat label="Created" value={imp.created} accent="teal" />
        <Stat label="Updated" value={imp.updated} accent="navy" />
        <Stat
          label="Errors"
          value={imp.errors + parseErrors.length}
          accent={imp.errors + parseErrors.length > 0 ? "coral" : undefined}
        />
      </div>

      {parseErrors.length > 0 && (
        <div className="rounded-lg border border-coral/30 bg-coral/5 p-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-coral">
            CSV parse errors
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {parseErrors.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-mute">row {e.rowNumber}:</span>
                <span className="text-ink">{e.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {imp.outcomes.some((o) => o.status === "error") && (
        <div className="rounded-lg border border-coral/30 bg-coral/5 p-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-coral">
            Per-row import errors
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {imp.outcomes
              .filter((o) => o.status === "error")
              .map((o, i) => (
                <li key={i} className="flex flex-wrap gap-2">
                  <span className="font-mono text-mute">
                    row {o.rowNumber}:
                  </span>
                  <span className="font-mono text-ink">{o.email}</span>
                  <span className="text-coral">— {o.message}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {(imp.created > 0 || imp.updated > 0) && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 text-sm text-teal">
          ✓ {imp.created} new staff added, {imp.updated} existing rows updated.
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "teal" | "navy" | "coral";
}) {
  const tone =
    accent === "teal"
      ? "text-teal"
      : accent === "coral"
      ? "text-coral"
      : "text-navy";
  return (
    <div className="rounded-lg border border-cream bg-paper p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </p>
      <p className={`mt-1 font-serif text-2xl ${tone}`}>{value}</p>
    </div>
  );
}
