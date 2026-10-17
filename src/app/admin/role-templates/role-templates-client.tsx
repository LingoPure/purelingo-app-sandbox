"use client";

import { useState } from "react";
import { SKILL_KEYS, SKILL_LABELS, type SkillKey } from "@/lib/scoring/rubric";
import type { RoleTemplateReviewRow } from "@/lib/platform/role-templates";

const DEFINED_VIA_LABEL: Record<string, string> = {
  preset: "Built-in preset",
  voice_interview: "Voice-discovery interview",
  manual: "Hand-typed",
};

export function RoleTemplatesClient({
  initial,
}: {
  initial: RoleTemplateReviewRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/role-templates/${id}/${action}`, {
        method: "POST",
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `${action} failed (${res.status})`);
        return;
      }
      setRows((xs) => xs.filter((r) => r.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
        <p className="text-sm text-mute">
          Nothing awaiting review. Templates appear here when an employer
          publishes a role from their roles page.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}
      {rows.map((r) => (
        <section key={r.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-serif text-xl text-navy">{r.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                Submitted by {r.employerName} · {DEFINED_VIA_LABEL[r.defineVia] ?? r.defineVia}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => act(r.id, "reject")}
                className="rounded-full border border-coral/40 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-coral hover:bg-coral/5 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => act(r.id, "approve")}
                className="rounded-full bg-navy px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:opacity-50"
              >
                {busy === r.id ? "Working…" : "Approve & publish"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm text-ink">
            {r.sanitizedDescription || (
              <span className="italic text-mute">No sanitized description provided.</span>
            )}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SKILL_KEYS.map((skill: SkillKey) => (
              <div key={skill} className="rounded-md bg-mist/50 px-2 py-2 text-center">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-mute">
                  {SKILL_LABELS[skill]}
                </p>
                <p className="font-mono text-sm text-navy">{r.baselines[skill] ?? "—"}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
