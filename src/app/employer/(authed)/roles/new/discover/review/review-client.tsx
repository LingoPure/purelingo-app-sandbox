"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

const SKILL_LABEL: Record<string, string> = {
  speaking: "Speaking",
  listening: "Listening",
  writing: "Writing",
  reading: "Reading",
  grammar: "Grammar",
  live_interaction: "Live interaction",
};

type SkillEntry = {
  baseline: number;
  rationale: string;
  examples: string[];
};

type RoleProfile = {
  name: string;
  description: string;
  responsibilities: string[];
  vocabulary_domain: string[];
  skills: Record<SkillKey, SkillEntry>;
  notes_for_lesson_planner: string;
};

export function ReviewClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<RoleProfile | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "saving">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // On mount: pull the chat history from sessionStorage and call the
  // finalizer. If the history isn't there we bounce back to the chat.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("lp_role_discovery_history");
    } catch {
      // storage blocked — handled below
    }
    if (!raw) {
      setError("No interview transcript found — start a new interview.");
      setPhase("ready");
      return;
    }
    let history: unknown;
    try {
      history = JSON.parse(raw);
    } catch {
      setError("Couldn't read the saved interview transcript.");
      setPhase("ready");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/employer/roles/discover/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history }),
        });
        const data: { profile?: RoleProfile; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (!res.ok || !data.profile) {
          setError(data.error ?? `Finalize failed (${res.status})`);
          setPhase("ready");
          return;
        }
        setProfile(data.profile);
        setPhase("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Finalize failed");
        setPhase("ready");
      }
    })();
  }, []);

  function setName(v: string) {
    setProfile((p) => (p ? { ...p, name: v } : p));
  }
  function setDescription(v: string) {
    setProfile((p) => (p ? { ...p, description: v } : p));
  }
  function setBaseline(skill: SkillKey, v: number) {
    setProfile((p) =>
      p
        ? {
            ...p,
            skills: {
              ...p.skills,
              [skill]: { ...p.skills[skill], baseline: v },
            },
          }
        : p
    );
  }
  function setRationale(skill: SkillKey, v: string) {
    setProfile((p) =>
      p
        ? {
            ...p,
            skills: {
              ...p.skills,
              [skill]: { ...p.skills[skill], rationale: v },
            },
          }
        : p
    );
  }
  function setNotes(v: string) {
    setProfile((p) => (p ? { ...p, notes_for_lesson_planner: v } : p));
  }
  function setResponsibilities(v: string) {
    // textarea-edited as one bullet per line
    setProfile((p) =>
      p
        ? {
            ...p,
            responsibilities: v
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : p
    );
  }
  function setVocabDomain(v: string) {
    setProfile((p) =>
      p
        ? {
            ...p,
            vocabulary_domain: v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : p
    );
  }

  function onSave() {
    if (!profile) return;
    if (!profile.name.trim()) {
      setError("Role name can't be empty.");
      return;
    }
    setError(null);
    setPhase("saving");
    startTransition(async () => {
      const baselines = Object.fromEntries(
        SKILL_KEYS.map((k) => [k, profile.skills[k].baseline])
      );
      const res = await fetch("/api/employer/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name.trim(),
          description: profile.description.trim(),
          baselines,
          profileJson: profile,
        }),
      });
      const data: { ok?: boolean; id?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        setPhase("ready");
        return;
      }
      try {
        sessionStorage.removeItem("lp_role_discovery_history");
      } catch {
        // ignore
      }
      router.push("/employer/roles");
      router.refresh();
    });
  }

  if (phase === "loading") {
    return (
      <section className="rounded-lg border border-cream bg-paper p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          Generating role profile…
        </p>
        <p className="mt-2 text-sm text-mute">
          Reading the transcript and calibrating baselines. Takes a few
          seconds.
        </p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="rounded-lg border border-coral/30 bg-coral/5 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-coral">
          Couldn&apos;t generate profile
        </p>
        <p className="mt-2 text-sm text-ink">
          {error ?? "Something went wrong. Start a new interview."}
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Role basics
        </p>
        <div className="flex flex-col gap-4">
          <Field label="Role name">
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={profile.description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            />
          </Field>
          <Field
            label="Responsibilities"
            hint="One bullet per line."
          >
            <textarea
              value={profile.responsibilities.join("\n")}
              onChange={(e) => setResponsibilities(e.target.value)}
              rows={Math.max(3, profile.responsibilities.length + 1)}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            />
          </Field>
          <Field
            label="Vocabulary domain"
            hint="Comma-separated."
          >
            <input
              type="text"
              value={profile.vocabulary_domain.join(", ")}
              onChange={(e) => setVocabDomain(e.target.value)}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Per-skill baselines
        </p>
        <h2 className="mb-4 font-serif text-xl text-navy">
          What &ldquo;good enough&rdquo; looks like for this role
        </h2>
        <div className="flex flex-col gap-4">
          {SKILL_KEYS.map((skill) => (
            <SkillBlock
              key={skill}
              label={SKILL_LABEL[skill] ?? skill}
              entry={profile.skills[skill]}
              onBaseline={(v) => setBaseline(skill, v)}
              onRationale={(v) => setRationale(skill, v)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Notes for the lesson planner
        </p>
        <textarea
          value={profile.notes_for_lesson_planner}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
        />
        <p className="mt-2 text-xs text-mute">
          Free-form guidance the future lesson generator will read when
          choosing scenarios for this role.
        </p>
      </section>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || phase === "saving"}
          className="rounded-full bg-navy px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:opacity-50"
        >
          {phase === "saving" ? "Saving…" : "Save role"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/employer/roles/new/discover")}
          disabled={isPending}
          className="rounded-full border border-cream bg-paper px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-navy hover:bg-mist/40"
        >
          Cancel
        </button>
      </div>
    </div>
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

function SkillBlock({
  label,
  entry,
  onBaseline,
  onRationale,
}: {
  label: string;
  entry: SkillEntry;
  onBaseline: (v: number) => void;
  onRationale: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-cream bg-mist/20 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="font-mono text-lg text-navy">{entry.baseline}</p>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={10}
        value={entry.baseline}
        onChange={(e) => onBaseline(Number(e.target.value))}
        className="w-full accent-navy"
      />
      <textarea
        value={entry.rationale}
        onChange={(e) => onRationale(e.target.value)}
        rows={2}
        maxLength={280}
        className="mt-3 w-full rounded-md border border-cream bg-paper px-3 py-2 text-xs italic text-ink focus:border-navy focus:outline-none"
      />
      {entry.examples.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {entry.examples.map((ex, i) => (
            <li key={i} className="text-xs text-mute">
              · {ex}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
