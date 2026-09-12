"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * P0 step 1: name the organisation → POST /api/org/create.
 * Owner becomes the creator; wizard continues at /org/[slug]/onboarding.
 */
export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not create organisation");
        return;
      }
      router.push(`/org/onboarding/${json.organisation_id}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Organisation name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Northwind Contact Centre"
          className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-teal"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">
          URL slug <span className="text-mute">(optional)</span>
        </span>
        <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 focus-within:border-teal">
          <span className="text-sm text-mute">/org/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "my-org"}
            className="w-full bg-transparent py-2.5 text-[15px] text-ink outline-none"
          />
        </div>
      </label>

      {error && (
        <p className="rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-2 rounded-md bg-navy px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create organisation →"}
      </button>
    </form>
  );
}