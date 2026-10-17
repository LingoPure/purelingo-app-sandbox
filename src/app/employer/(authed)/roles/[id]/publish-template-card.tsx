"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TemplateStatus = "private" | "pending_review" | "published";

export function PublishTemplateCard({
  roleId,
  roleName,
  templateStatus,
  initialSanitizedDescription,
}: {
  roleId: string;
  roleName: string;
  templateStatus: TemplateStatus;
  initialSanitizedDescription: string | null;
}) {
  const router = useRouter();
  const [sanitizedDescription, setSanitizedDescription] = useState(
    initialSanitizedDescription ?? ""
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (sanitizedDescription.trim().length < 10) {
      setError("Write at least a sentence — this is what other companies will see.");
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch(`/api/employer/roles/${roleId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sanitizedDescription: sanitizedDescription.trim() }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Submit failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function withdraw() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/employer/roles/${roleId}/publish`, {
        method: "DELETE",
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Withdraw failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
        Platform template
      </p>
      <h2 className="mb-2 font-serif text-xl text-navy">
        Share &ldquo;{roleName}&rdquo; with other companies
      </h2>

      {templateStatus === "published" ? (
        <p className="text-sm text-ink">
          <span className="text-teal">✓</span> Published — this role&apos;s sanitized
          description and baselines are now selectable from every other
          employer&apos;s staff-invite flow. Each adopting company gets their own
          independent copy.
        </p>
      ) : templateStatus === "pending_review" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">
            Submitted — waiting on a platform admin to review it.
          </p>
          <p className="rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink">
            {sanitizedDescription}
          </p>
          {error && <p className="text-sm text-coral">{error}</p>}
          <button
            type="button"
            onClick={withdraw}
            disabled={isPending}
            className="self-start font-mono text-[11px] uppercase tracking-[0.18em] text-coral hover:underline disabled:opacity-50"
          >
            Withdraw submission
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">
            Write a version of this role&apos;s description with nothing specific
            to your company — no client names, no internal process detail.
            A platform admin reviews it before it becomes visible elsewhere.
          </p>
          <textarea
            value={sanitizedDescription}
            onChange={(e) => setSanitizedDescription(e.target.value)}
            placeholder="e.g. Handles inbound customer calls, diagnosing the issue and resolving it or escalating with an accurate writeup."
            rows={3}
            maxLength={700}
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
          />
          {error && <p className="text-sm text-coral">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="self-start rounded-full border border-navy px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:bg-navy/5 disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      )}
    </div>
  );
}
