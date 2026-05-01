"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

type Role = { id: string; name: string; description: string | null };

type Props = {
  roles: Role[];
  initialRoleId: string | null;
  /** Translated copy from the parent server component. */
  copy: {
    languageLabel: string;
    languageName: string;
    languageExplain: string;
    readyHeading: string;
    readyLead: string;
    startButton: string;
    headphonesNote: string;
  };
};

export function RoleConfirmAndStart({ roles, initialRoleId, copy }: Props) {
  const [roleId, setRoleId] = useState(initialRoleId ?? roles[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    if (!roleId) {
      setError("Pick a role first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setConfirmed(true);
    });
  }

  if (roles.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-cream bg-paper p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-coral">
          No roles available
        </p>
        <p className="mt-2 text-sm text-mute">
          Your administrator hasn&apos;t set up any roles yet. Ask them to add
          one before starting your discovery session.
        </p>
      </section>
    );
  }

  if (!confirmed) {
    const selected = roles.find((r) => r.id === roleId);
    return (
      <section className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Step 1
        </p>
        <h2 className="mb-2 font-serif text-2xl text-navy">
          Confirm the role you&apos;re here for
        </h2>
        <p className="mb-5 text-sm text-mute">
          The role you pick sets the bar your gap analysis is measured against.
          Pick the role you&apos;re actually doing — not a stretch goal.
        </p>

        <div className="flex flex-col gap-3">
          <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Role
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            disabled={isPending}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {selected?.description && (
            <p className="rounded-md bg-cream/50 px-3 py-2 text-xs italic text-mute">
              {selected.description}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
            {error}
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Confirm role and continue →"}
          </button>
        </div>
      </section>
    );
  }

  // Step 2 — meet Aria + start discovery (matches the original CTA card).
  return (
    <section className="rounded-lg border border-cream bg-paper p-8 text-center">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
        Step 2
      </p>
      <div className="relative mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full ring-2 ring-cream ring-offset-2 ring-offset-paper">
        <Image
          src="/kira-avatar.jpg"
          alt="Aria, your discovery consultant"
          fill
          sizes="96px"
          className="object-cover"
          priority
        />
      </div>
      <p className="mb-1 font-serif text-base text-navy">Meet Aria</p>
      <h2 className="mb-2 font-serif text-2xl text-navy">{copy.readyHeading}</h2>
      <p className="mb-2 text-sm text-mute">{copy.readyLead}</p>
      <p className="mb-6 text-sm text-ink">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          {copy.languageLabel}
        </span>
        <br />
        <span className="font-serif text-lg text-navy">
          {copy.languageName}
        </span>
        <br />
        <span className="text-xs text-mute">{copy.languageExplain}</span>
      </p>
      <Link
        href="/onboarding/session"
        className="inline-block rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep"
      >
        {copy.startButton} →
      </Link>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-mute">
        {copy.headphonesNote}
      </p>
    </section>
  );
}
