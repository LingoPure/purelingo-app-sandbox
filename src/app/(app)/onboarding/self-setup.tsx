"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n/dictionary";

type RoleKey =
  | "inbound_sales"
  | "outbound_sales"
  | "inbound_customer_service"
  | "inbound_tech_support"
  | "back_office"
  | "quality_assurance"
  | "recruitment_hr"
  | "accounts_finance"
  | "training_ld";

// Six PRIMARY dimensions only (ISS-048) — the two supporting measures
// (business_vocabulary, presentation_delivery) are not role-customised;
// they use the flat 800 default everywhere. grammar/live_interaction are
// genuinely new dimensions with no historical data, so these numbers are
// a judgment call (not derived from prior scores) — set per role from the
// same rationale as the existing four: grammar tracks written-precision
// demand, live_interaction tracks how real-time/reactive the role is.
type BaselineScores = {
  speaking: number;
  listening: number;
  writing: number;
  reading: number;
  grammar: number;
  live_interaction: number;
};

type RoleDef = {
  key: RoleKey;
  name: string;
  rationale: string;
  baselines: BaselineScores;
};

const ROLES: RoleDef[] = [
  {
    key: "inbound_sales",
    name: "Inbound Sales",
    rationale:
      "Must decode prospect intent; talking well is useless if you pitch the wrong thing",
    baselines: {
      speaking: 650,
      listening: 700,
      writing: 400,
      reading: 450,
      grammar: 450,
      live_interaction: 650,
    },
  },
  {
    key: "outbound_sales",
    name: "Outbound Sales",
    rationale:
      "Cold outreach is persuasion; fluency and confidence determine whether they stay on the line",
    baselines: {
      speaking: 750,
      listening: 550,
      writing: 450,
      reading: 400,
      grammar: 500,
      live_interaction: 700,
    },
  },
  {
    key: "inbound_customer_service",
    name: "Inbound Customer Service",
    rationale:
      "Customer leads the conversation; misunderstanding the issue = wrong resolution = churn",
    baselines: {
      speaking: 600,
      listening: 750,
      writing: 450,
      reading: 500,
      grammar: 500,
      live_interaction: 750,
    },
  },
  {
    key: "inbound_tech_support",
    name: "Inbound Tech Support",
    rationale:
      "Must extract precise technical details from non-technical users; vocabulary prevents miscommunication",
    baselines: {
      speaking: 550,
      listening: 700,
      writing: 550,
      reading: 600,
      grammar: 600,
      live_interaction: 700,
    },
  },
  {
    key: "back_office",
    name: "Back Office Operations",
    rationale:
      "Document-in, document-out function; spoken English is irrelevant to core output",
    baselines: {
      speaking: 350,
      listening: 400,
      writing: 650,
      reading: 650,
      grammar: 700,
      live_interaction: 300,
    },
  },
  {
    key: "quality_assurance",
    name: "Quality Assurance",
    rationale:
      "Evaluates interactions and writes evaluations; analytical documentation function",
    baselines: {
      speaking: 450,
      listening: 650,
      writing: 700,
      reading: 700,
      grammar: 700,
      live_interaction: 500,
    },
  },
  {
    key: "recruitment_hr",
    name: "Recruitment / HR",
    rationale:
      "Shifts between reading resumes, interviewing, writing policies — no single skill dominates",
    baselines: {
      speaking: 600,
      listening: 550,
      writing: 600,
      reading: 550,
      grammar: 600,
      live_interaction: 600,
    },
  },
  {
    key: "accounts_finance",
    name: "Accounts / Finance",
    rationale:
      "Document-driven function; financial writing precision prevents real risk",
    baselines: {
      speaking: 350,
      listening: 350,
      writing: 700,
      reading: 700,
      grammar: 750,
      live_interaction: 300,
    },
  },
  {
    key: "training_ld",
    name: "Training / L&D",
    rationale:
      "Training IS delivery; if they cannot present, nothing else matters",
    baselines: {
      speaking: 700,
      listening: 500,
      writing: 550,
      reading: 500,
      grammar: 550,
      live_interaction: 650,
    },
  },
];

function BaselineRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 text-xs text-mute">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-mist">
        <div
          className="h-2 rounded-full bg-navy/70"
          style={{ width: `${Math.min(100, score / 10)}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs text-navy">
        {score}
      </span>
    </div>
  );
}

export function SelfSetup() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey | "">("");
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>("en");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedRole = ROLES.find((r) => r.key === roleKey);

  function onSubmit() {
    if (!orgName.trim() || !roleKey) {
      setError("Please complete all fields.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding/self-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          role: ROLES.find((r) => r.key === roleKey)!.name,
          nativeLanguage,
          baselines: selectedRole!.baselines,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Setup failed (${res.status})`);
        return;
      }
      router.push("/onboarding/session");
    });
  }

  return (
    <section className="rounded-lg border border-cream bg-paper p-6">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
        Self-Setup
      </p>
      <h2 className="mb-2 font-serif text-2xl text-navy">
        Set up your team profile
      </h2>
      <p className="mb-5 text-sm text-mute">
        Tell us about your team and primary role. This calibrates Aria&rsquo;s
        initial gap analysis.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Organisation Name
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            placeholder="e.g. Acme Corp"
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Primary Role
          </label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value as RoleKey | "")}
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            disabled={isPending}
          >
            <option value="">Pick a role...</option>
            {ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          {selectedRole && (
            <p className="rounded-md bg-cream/50 px-3 py-2 text-xs italic text-mute">
              {selectedRole.rationale}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Native language
          </label>
          <select
            value={nativeLanguage}
            onChange={(e) =>
              setNativeLanguage(e.target.value as LanguageCode)
            }
            className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            disabled={isPending}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRole && (
        <div className="mt-6 space-y-2 rounded-lg border border-cream bg-mist/20 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Role baseline (what this role demands)
          </p>
          <BaselineRow
            label="Speaking"
            score={selectedRole.baselines.speaking}
          />
          <BaselineRow
            label="Listening"
            score={selectedRole.baselines.listening}
          />
          <BaselineRow
            label="Writing"
            score={selectedRole.baselines.writing}
          />
          <BaselineRow
            label="Reading"
            score={selectedRole.baselines.reading}
          />
          <BaselineRow
            label="Grammar"
            score={selectedRole.baselines.grammar}
          />
          <BaselineRow
            label="Live interaction"
            score={selectedRole.baselines.live_interaction}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
          {error}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !orgName.trim() || !roleKey}
          className="inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep disabled:opacity-70"
        >
          {isPending ? "Setting up your workspace..." : "Confirm and start discovery →"}
        </button>
      </div>
    </section>
  );
}