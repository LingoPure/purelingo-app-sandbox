"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NdaAccept({ version }: { version: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/investor/nda/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signerName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not record acceptance.");
      router.push("/investor/ask");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  const canAccept = agree && name.trim().length >= 2 && !pending;

  return (
    <div className="space-y-3 rounded-2xl border border-cream bg-paper p-4 sm:p-6">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Type your full legal name to sign</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Investor"
          className="min-h-[44px] rounded-md border border-cream bg-paper px-3 text-base text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-navy/80">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          I have read and agree to the LingoPure NDA, Non-Compete,
          Non-Circumvention and Intellectual Property Protection Agreement
          (version {version}), and I am authorised to accept it.
        </span>
      </label>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button
        type="button"
        onClick={accept}
        disabled={!canAccept}
        className="min-h-[44px] rounded-md bg-navy px-5 text-base font-medium text-paper disabled:opacity-40"
      >
        {pending ? "Recording…" : "Accept & unlock deep dive"}
      </button>
    </div>
  );
}
