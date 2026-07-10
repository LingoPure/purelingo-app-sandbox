"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EditorRow = {
  id: string;
  email: string;
  role: "admin" | "marketing" | "readonly";
  accepted_at: string | null;
  invited_at: string;
};

type InviteResult = {
  ok?: boolean;
  message?: string;
  actionLink?: string | null;
  mailWarning?: string | null;
  error?: string;
};

export function EditorsClient({ initialEditors }: { initialEditors: EditorRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "marketing" | "readonly">("marketing");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/content-editors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const body = (await res.json().catch(() => ({}))) as InviteResult;
      if (!res.ok) {
        setResult({ error: body.error ?? `HTTP ${res.status}` });
      } else {
        setResult(body);
        setName("");
        setEmail("");
        router.refresh();
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Invite failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <form
        onSubmit={invite}
        className="rounded-lg border border-cream bg-paper p-5"
      >
        <h2 className="font-serif text-lg text-navy">Invite an editor</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Full name"
            className="min-h-[44px] rounded-md border border-cream px-3 text-base text-navy outline-none focus:border-navy/40"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            placeholder="email@company.com"
            className="min-h-[44px] rounded-md border border-cream px-3 text-base text-navy outline-none focus:border-navy/40"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="min-h-[44px] rounded-md border border-cream px-3 text-base text-navy outline-none focus:border-navy/40"
          >
            <option value="marketing">Marketing (edit)</option>
            <option value="readonly">Read-only (preview)</option>
            <option value="admin">Admin (edit + manage)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper transition hover:bg-navy-deep disabled:opacity-50"
        >
          {busy ? "Inviting…" : "Send invite"}
        </button>

        {result?.error ? (
          <p className="mt-3 text-sm text-coral">{result.error}</p>
        ) : null}
        {result?.ok ? (
          <div className="mt-3 rounded-md border border-cream bg-mist px-3 py-2 text-sm text-navy">
            <p>{result.message}</p>
            {result.mailWarning ? (
              <p className="mt-1 text-mute">{result.mailWarning}</p>
            ) : null}
            {result.actionLink ? (
              <p className="mt-2 break-all font-mono text-xs text-mute">
                {result.actionLink}
              </p>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="rounded-lg border border-cream bg-paper">
        <div className="border-b border-cream px-5 py-3">
          <h2 className="font-serif text-lg text-navy">Current editors</h2>
        </div>
        {initialEditors.length === 0 ? (
          <p className="px-5 py-4 text-sm text-mute">No editors yet.</p>
        ) : (
          <ul className="divide-y divide-cream">
            {initialEditors.map((ed) => (
              <li
                key={ed.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <span className="text-sm text-navy">{ed.email}</span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-mist px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-navy">
                    {ed.role}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-mute">
                    {ed.accepted_at ? "active" : "invited"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
