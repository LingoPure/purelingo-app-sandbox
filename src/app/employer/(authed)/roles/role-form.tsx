"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";
import type { RoleBaselines } from "@/lib/employer/roles-data";

const SKILL_LABEL: Record<string, string> = {
  speaking_fluency: "Speaking fluency",
  listening_comprehension: "Listening comprehension",
  writing_formal: "Formal writing",
  reading_intent: "Reading intent",
  business_vocabulary: "Business vocabulary",
  presentation_delivery: "Presentation delivery",
};

const SKILL_HINT: Record<string, string> = {
  speaking_fluency: "Pace, hesitation, sentence-level flow on calls.",
  listening_comprehension: "Following accented English in real time.",
  writing_formal: "Email register, structure, grammar accuracy.",
  reading_intent: "Reading what the customer is really asking for.",
  business_vocabulary: "Range and precision of business terms.",
  presentation_delivery: "Structure, signposting, authority of delivery.",
};

export type RoleFormProps = {
  mode: "create" | "edit";
  roleId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialBaselines: RoleBaselines;
  initialIsArchived?: boolean;
};

export function RoleForm({
  mode,
  roleId,
  initialName = "",
  initialDescription = "",
  initialBaselines,
  initialIsArchived = false,
}: RoleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [baselines, setBaselines] = useState<RoleBaselines>(initialBaselines);
  const [isArchived, setIsArchived] = useState(initialIsArchived);
  const [error, setError] = useState<string | null>(null);

  function setBaseline(skill: SkillKey, value: number) {
    setBaselines((prev) => ({ ...prev, [skill]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      baselines,
      ...(mode === "edit" ? { isArchived } : {}),
    };
    if (!payload.name) {
      setError("Name is required.");
      return;
    }

    const url =
      mode === "create"
        ? "/api/employer/roles"
        : `/api/employer/roles/${roleId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: { ok?: boolean; id?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      router.push("/employer/roles");
      router.refresh();
    });
  }

  async function onArchiveDelete() {
    if (mode !== "edit" || !roleId) return;
    if (!confirm("Archive this role? Students stay assigned; the role is hidden from new assignments.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/employer/roles/${roleId}`, {
        method: "DELETE",
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Archive failed (${res.status})`);
        return;
      }
      router.push("/employer/roles");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="rounded-lg border border-cream bg-paper p-6">
        <div className="flex flex-col gap-4">
          <Field label="Role name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Manufacturing Sales Rep"
              maxLength={120}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
              required
            />
          </Field>
          <Field
            label="Description"
            hint="Free text — the lesson generators feed this in as role context."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this person actually does in English, day to day."
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Per-skill baselines
        </p>
        <h2 className="mb-4 font-serif text-xl text-navy">
          What &ldquo;good enough&rdquo; looks like for this role
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SKILL_KEYS.map((skill) => (
            <BaselineField
              key={skill}
              label={SKILL_LABEL[skill] ?? skill}
              hint={SKILL_HINT[skill]}
              value={baselines[skill]}
              onChange={(v) => setBaseline(skill, v)}
            />
          ))}
        </div>
      </div>

      {mode === "edit" && (
        <div className="rounded-lg border border-cream bg-paper p-6">
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={isArchived}
              onChange={(e) => setIsArchived(e.target.checked)}
              className="h-4 w-4"
            />
            Archived (hidden from new assignments)
          </label>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-navy px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : mode === "create"
              ? "Create role"
              : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/employer/roles")}
            className="rounded-full border border-cream bg-paper px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-navy hover:bg-mist/40"
          >
            Cancel
          </button>
        </div>
        {mode === "edit" && !isArchived && (
          <button
            type="button"
            onClick={onArchiveDelete}
            disabled={isPending}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-coral hover:underline disabled:opacity-50"
          >
            Archive role
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-mute">{hint}</p>}
    </div>
  );
}

function BaselineField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-md border border-cream bg-mist/20 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="font-mono text-lg text-navy">{value}</p>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-navy"
      />
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-mute">
        <span>0</span>
        <span>500</span>
        <span>1000</span>
      </div>
      {hint && <p className="mt-2 text-xs text-mute">{hint}</p>}
    </div>
  );
}
