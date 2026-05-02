"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  PlanRecommendation,
} from "@/lib/lessons/plan-generator";

type Props = {
  recommendations: PlanRecommendation[];
};

/**
 * Gap-driven lesson plan card. Reads recommendations produced server-side
 * by generateLessonPlan() and renders the top three with one-click
 * "Start" buttons. Micro-lesson buttons POST /api/lessons to mint a fresh
 * lesson row, then route to the lesson page; class buttons scroll to the
 * existing schedule-class section.
 *
 * Empty state (no recommendations = student is at or above every
 * baseline) renders a celebratory note instead of the rec list.
 */
export function RecommendedPlan({ recommendations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const top = recommendations.slice(0, 3);

  function startLesson(rec: PlanRecommendation) {
    if (rec.kind !== "micro_lesson" || !rec.lessonType) return;
    const key = `${rec.kind}-${rec.lessonType}-${rec.skill}`;
    setBusyKey(key);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: rec.lessonType }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      setBusyKey(null);
      if (!res.ok || !data.ok || !data.id) {
        setError(data.error ?? `Couldn't start lesson (${res.status})`);
        return;
      }
      router.push(`/lessons/${data.id}`);
    });
  }

  if (top.length === 0) {
    return (
      <section className="rounded-lg border border-teal/30 bg-teal/5 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal">
          Recommended next
        </p>
        <h3 className="mt-1 font-serif text-xl text-navy">
          You&apos;re at or above your role baseline on every skill
        </h3>
        <p className="mt-2 text-sm text-mute">
          Your profile is hitting the bar. Keep practising to push above
          baseline, or use the Re-score button to refresh after recent class
          activity.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-cream bg-paper p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">
            Recommended next
          </p>
          <h3 className="mt-1 font-serif text-xl text-navy">
            Your gap-driven plan
          </h3>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          {recommendations.length}{" "}
          {recommendations.length === 1 ? "item" : "items"}
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {top.map((rec, i) => {
          const key = `${rec.kind}-${rec.lessonType ?? "class"}-${rec.skill}-${i}`;
          const isBusy = pending && busyKey === key;
          return (
            <li
              key={key}
              className={
                "rounded-md border p-4 " +
                (rec.priority === "critical"
                  ? "border-coral/40 bg-coral/5"
                  : rec.priority === "recommended"
                    ? "border-cream bg-mist/30"
                    : "border-cream bg-paper")
              }
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy">
                  {rec.priority === "critical"
                    ? "Critical · "
                    : rec.priority === "recommended"
                      ? ""
                      : "Optional · "}
                  {rec.skillLabel} · gap {rec.gap}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                  {rec.kind === "micro_lesson" ? "Micro-lesson" : "Live class"}
                </p>
              </div>
              <h4 className="mt-1 font-serif text-base text-navy">{rec.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-mute">
                {rec.rationale}
              </p>
              <div className="mt-3">
                {rec.kind === "micro_lesson" ? (
                  <button
                    type="button"
                    onClick={() => startLesson(rec)}
                    disabled={pending}
                    className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBusy ? "Starting…" : "Start lesson →"}
                  </button>
                ) : (
                  <Link
                    href={rec.ctaHref}
                    className="inline-block rounded-md border border-navy/30 px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
                  >
                    Schedule a class →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="mt-4 rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}
    </section>
  );
}
