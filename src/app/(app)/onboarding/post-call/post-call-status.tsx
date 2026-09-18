"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bilingual } from "@/lib/i18n/translate";
import type { SkillKey } from "@/lib/scoring/rubric";

type Props = {
  name: string | null;
  initiallyComplete: boolean;
  /** Bilingual (English + native gloss) copies of the persistent copy. */
  copy: {
    kickerWait: Bilingual;
    kickerDone: Bilingual;
    titleWait: Bilingual;
    titleDone: Bilingual;
    intro: Bilingual;
    steps: Array<{ title: Bilingual; desc: Bilingual }>;
  };
};

const POLL_MS = 3000;
const MAX_POLL_ERRORS = 4;
const AUTO_ADVANCE_MS = 6000;
const WAIT_LIMIT_MS = 120_000;
const SCORE_SCALE = 1000;

type StatusBody = {
  discovery_status: string;
  complete: boolean;
  scores: Array<{ skill: SkillKey; score: number; target: number }> | null;
};

const SKILL_LABELS: Partial<Record<SkillKey, string>> = {
  speaking_fluency: "Speaking fluency",
  listening_comprehension: "Listening comprehension",
  writing_formal: "Writing — formal",
  reading_intent: "Reading — intent",
  business_vocabulary: "Business vocabulary",
  presentation_delivery: "Presentation",
};

/** English primary with the native-language gloss underneath. */
function Gloss({ b, className }: { b: Bilingual; className?: string }) {
  if (!b.translated) return <span className={className}>{b.en}</span>;
  return (
    <span className={className}>
      {b.en}
      <span className="mt-0.5 block text-xs text-mute">{b.native}</span>
    </span>
  );
}

function SkillBar({
  label,
  score,
  target,
}: {
  label: string;
  score: number;
  target: number;
}) {
  const clamped = Math.max(0, Math.min(SCORE_SCALE, score));
  const targetClamped = Math.max(0, Math.min(SCORE_SCALE, target));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-navy">{label}</span>
        <span className="font-mono text-xs text-mute">
          {score} <span className="text-mute/60">/ {SCORE_SCALE}</span>
          <span className="ml-2 text-mute/70">target {Math.round(target)}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-visible rounded-full bg-mist">
        <div
          className="h-full rounded-full bg-teal"
          style={{ width: `${(clamped / SCORE_SCALE) * 100}%` }}
        />
        <div
          className="absolute -top-0.5 h-3 w-0.5 bg-navy"
          style={{ left: `${(targetClamped / SCORE_SCALE) * 100}%` }}
          title={`Target ${target}`}
        />
      </div>
    </div>
  );
}

export function PostCallStatus({ name, initiallyComplete, copy }: Props) {
  const router = useRouter();
  const [complete, setComplete] = useState(initiallyComplete);
  const [scores, setScores] = useState<StatusBody["scores"]>(null);
  const [failures, setFailures] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const advancedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (initiallyComplete) advancedAtRef.current = Date.now();
  }, [initiallyComplete]);

  useEffect(() => {
    if (initiallyComplete) return;
    const startedAt = Date.now();
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/onboarding/discovery/status");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as StatusBody;
        if (stopped) return;
        setFailures(0);
        if (body.complete) {
          setComplete(true);
          if (body.scores) setScores(body.scores);
          advancedAtRef.current = Date.now();
        }
      } catch {
        if (stopped) return;
        setFailures((n) => n + 1);
      }
    };

    const interval = setInterval(() => {
      if (Date.now() - startedAt > WAIT_LIMIT_MS) {
        setTimedOut(true);
        return;
      }
      void poll();
    }, POLL_MS);
    void poll();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [initiallyComplete]);

  useEffect(() => {
    if (!complete || !advancedAtRef.current) return;
    const t = setTimeout(() => router.push("/onboarding/battery"), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [complete, router]);

  const stalled = timedOut || (failures >= MAX_POLL_ERRORS && !complete);
  const greet = name ? `, ${name}` : "";
  const visibleSteps = copy.steps;

  const scoredBars =
    scores && scores.length > 0
      ? scores
          .map((s) => ({
            ...s,
            label: SKILL_LABELS[s.skill] ?? s.skill,
          }))
          .sort((a, b) => b.score - a.score)
      : null;

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-cream bg-paper p-6 sm:p-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          <Gloss b={complete ? copy.kickerDone : copy.kickerWait} />
        </p>
        <h2 className="mt-1 font-serif text-2xl text-navy">
          <Gloss b={complete ? copy.titleDone : copy.titleWait} />
          {greet}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
          <Gloss b={copy.intro} />
        </p>
      </div>

      {scoredBars ? (
        <section aria-label="Voice skill scores">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
            Your voice profile out of {SCORE_SCALE}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {scoredBars.map((bar) => (
              <SkillBar
                key={bar.skill}
                label={bar.label}
                score={bar.score}
                target={bar.target}
              />
            ))}
          </div>
        </section>
      ) : (
        <ol className="flex flex-col gap-3">
          {visibleSteps.map((step, i) => {
            const state = complete ? "done" : i === 0 ? "active" : "upcoming";
            return (
              <li
                key={i}
                className={`flex gap-4 rounded-md border p-4 ${
                  state === "active"
                    ? "border-gold/40 bg-gold/5"
                    : state === "done"
                      ? "border-teal/30 bg-teal/5"
                      : "border-cream bg-mist/30"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                    state === "done"
                      ? "border-teal bg-teal text-white"
                      : state === "active"
                        ? "border-gold bg-gold text-navy"
                        : "border-cream text-mute"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <div>
                  <h3 className="font-serif text-base text-navy">
                    <Gloss b={step.title} />
                  </h3>
                  <p className="mt-1 text-sm text-mute">
                    <Gloss b={step.desc} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-col gap-3 border-t border-cream pt-4">
        {stalled ? (
          <div className="rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">
              Your profile is taking longer than expected.
            </p>
            <p className="mt-1">
              This usually means the call ended before scoring could run. You can
              continue anyway — your voice scores will re-run when they land.
            </p>
          </div>
        ) : (
          <p className="text-xs text-mute">
            {complete
              ? "Taking you to the next step…"
              : "This usually takes under a minute — you don't need to do anything."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push("/onboarding/battery")}
            disabled={!complete && !stalled}
            className={`rounded-md px-5 py-2.5 text-sm font-medium transition-colors ${
              complete || stalled
                ? "bg-navy text-paper hover:bg-navy/90"
                : "cursor-not-allowed bg-mist text-mute"
            }`}
          >
            {complete
              ? "Continue to your written assessment →"
              : stalled
                ? "Continue anyway →"
                : "Waiting for your profile…"}
          </button>
        </div>
      </div>
    </section>
  );
}