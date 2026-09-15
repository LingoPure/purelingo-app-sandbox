"use client";

import { useState } from "react";

/**
 * "Add client org" — the platform-admin counterpart to self-serve /org/new.
 * Creates the org owned by the client contact and returns the invite link
 * (copy-pasteable; email is best-effort via Resend).
 */
const PACKAGES = ["1:1 Tutoring", "Tutor + AI", "Full BPO"] as const;

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      slug: string;
      owner: "linked" | "invited" | "actor";
      inviteLink?: string;
      mailOk?: boolean;
    }
  | { status: "error"; message: string };

export function AddClientOrg() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState<string>("");
  const [result, setResult] = useState<ResultState>({ status: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult({ status: "loading" });
    const res = await fetch("/api/admin/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ownerEmail: email || undefined,
        package: (pkg || undefined) as "1:1 Tutoring" | "Tutor + AI" | "Full BPO" | undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setResult({
        status: "error",
        message: data?.error ?? "Could not create the organisation",
      });
      return;
    }
    setResult({
      status: "ok",
      slug: data.slug,
      owner: data.owner,
      inviteLink: data.invite?.actionLink,
      mailOk: data.invite?.mailOk,
    });
    setName("");
    setEmail("");
    setPkg("");
  }

  return (
    <div className="mb-6 rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-serif text-lg text-navy">Add a client org</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-navy hover:bg-mist/50"
        >
          {open ? "Close" : "New"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="border-t border-line px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mute">
                Organisation name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Acme Pacific BPO"
                className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mute">
                Owner email (optional)
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@acme.com"
                className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mute">
                Package (optional)
              </span>
              <select
                value={pkg}
                onChange={(e) => setPkg(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">Pick later in wizard</option>
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={result.status === "loading"}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
            >
              {result.status === "loading" ? "Creating…" : "Create org"}
            </button>
          </div>

          {result.status === "ok" && (
            <div className="mt-4 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-sm text-ink">
              <p>
                <span className="font-medium">{result.slug}</span> created — owner is{" "}
                {result.owner === "linked"
                  ? "linked to their existing account"
                  : result.owner === "invited"
                    ? "invited (new account provisioned)"
                    : "the platform admin (no owner email given)"}
                .
              </p>
              {result.inviteLink && (
                <p className="mt-1">
                  Invite link:{" "}
                  <a
                    href={result.inviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-mono text-xs text-teal underline"
                  >
                    {result.inviteLink}
                  </a>
                  {result.mailOk === false && (
                    <span className="block text-xs text-amber">
                      Email not configured — copy the link above and send it manually.
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-mute">
                They&apos;ll land at /org/{result.slug} and the wizard resumes at the right step.
              </p>
            </div>
          )}

          {result.status === "error" && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {result.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}