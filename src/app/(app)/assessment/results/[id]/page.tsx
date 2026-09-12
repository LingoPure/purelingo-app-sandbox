// @explanatory-header-exempt — result page carries the assessment-tel threshold header below
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAssessmentPipeline } from "@/lib/2k/journey-data";
import { buildLearnerDeliveryView } from "@/lib/2k/learner-delivery";
import { ScoreRing } from "@/components/telemetry/score-ring";
import { TRadar } from "@/components/telemetry/radar";
import "@/components/telemetry/telemetry.css";

const CAPABILITY_LABELS: Record<string, string> = {
  FLUENCY: "Fluency",
  LISTENING: "Listening",
  WRITING: "Writing",
  READING_INTENT: "Reading intent",
  VOCABULARY: "Vocabulary",
  PRESENTATION: "Presenting",
  REPAIR: "Repair",
  FRAME_INTEGRITY: "Frame integrity",
  BIDDING: "Bidding",
  ALIGNMENT: "Alignment",
};

const BAND_COLORS: Record<string, string> = {
  Survival: "#ff6575",
  Functional: "#ff9f1c",
  Professional: "#f6c344",
  "Stable Professional": "#35c9ef",
  "Executive Stability": "#80d84d",
  "Strategic Mastery": "#a879ff",
};

function capLabel(address: string): string {
  return CAPABILITY_LABELS[address] ?? address.replace(/_/g, " ");
}

export default async function AssessmentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pipeline = user ? await loadAssessmentPipeline(supabase, id) : null;

  // RLS-scoped: only the owning learner (or a future §7 org path) can read this
  // assessment; otherwise loadAssessmentPipeline returns null because the
  // responses/session rows aren't visible.
  const isOwner = pipeline?.session.learner_id === user?.id;
  if (!pipeline || !isOwner) notFound();

  const result = pipeline.result;
  const learner = buildLearnerDeliveryView(result);

  const radarSkills = learner.capabilities.slice(0, 6).map((c) => ({
    key: c.address,
    label: capLabel(c.address),
    score: c.score,
    target: 800,
  }));

  const dims = result.telemetry.dimensions.map((d) => ({
    ...d,
    pct: Math.round(d.score * 100),
  }));

  const delays: { name: string; score: number; confidence: number }[] =
    result.telemetry.dimensions.filter((d) => d.score < 0.6);

  return (
    <div className="telemetry min-h-screen p-4 pb-12 sm:p-6 lg:p-8">
      {/* header bar */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="t-eyebrow">Master Brain · Student view</p>
          <h1 className="mt-1 font-serif text-2xl text-t-soft sm:text-3xl">
            Your communication, explained.
          </h1>
          <p className="t-muted mt-1">
            What the engine measured, what is holding your score back, and how to reach the next level.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-pill">Frozen result {result.result_id.slice(0, 8)}</span>
          <span className="t-pill">{new Date(result.frozen_at).toLocaleDateString()}</span>
          <Link
            href="/dashboard"
            className="rounded-lg border border-t-line px-3 py-2 text-xs font-medium text-t-soft-mute hover:border-t-cyan hover:text-t-text"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>

      {/* 1 · WHERE YOU STAND NOW */}
      <section className="mx-auto mt-8 max-w-6xl">
        <p className="t-eyebrow-orange t-eyebrow">1 · Where you stand now</p>
        <h2 className="t-h2 mt-1">Your communication state, from real responses</h2>
        <div className="t-hero-grid mt-4">
          <article className="t-card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
            <div className="t-score-ring">
              <ScoreRing score={result.lp1000.score} color={BAND_COLORS[result.lp1000.band] ?? "#35c9ef"} />
              <div className="t-score-inner">
                <strong style={{ color: BAND_COLORS[result.lp1000.band] ?? "#35c9ef" }}>
                  {result.lp1000.score}
                </strong>
                <span>LP-1000</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="t-pill t-pill-good">{result.lp1000.band}</span>
                <span className="t-pill">CEFR {result.lp18.stable.cefr_macro}</span>
                <span className="t-pill">Confidence {(result.lp1000.confidence * 100).toFixed(0)}%</span>
              </div>
              <p className="t-muted mt-3">
                {learner.summary.strengths[0] ??
                  "Your scores form the baseline for your next assessment."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
                {result.lp1000.components &&
                  Object.entries(result.lp1000.components)
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-t-mute">{capLabel(key)}</span>
                        <span className="text-xs font-bold text-t-text">{Math.round(value)}</span>
                      </div>
                    ))}
              </div>
            </div>
          </article>

          <article className="t-card p-6">
            <div className="flex items-center justify-between">
              <p className="t-eyebrow-green t-eyebrow">6D communication shape</p>
              <span className="t-pill">vs target 800</span>
            </div>
            <div className="mt-4 flex justify-center">
              <TRadar skills={radarSkills} size={320} />
            </div>
          </article>
        </div>
      </section>

      {/* 2 · WHAT IS HOLDING THE SCORE BACK */}
      <section className="mx-auto mt-8 max-w-6xl">
        <p className="t-eyebrow t-eyebrow-purple">2 · What is holding the score back</p>
        <h2 className="t-h2 mt-1">The dimensions dragging the composite down</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="t-card p-6">
            <div className="flex items-center justify-between">
              <p className="t-eyebrow t-eyebrow-orange">Telemetry dimensions</p>
              <span className="t-pill">drift {(result.telemetry.drift * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-4">
              {dims.length === 0 && <p className="t-muted">No telemetry signals recorded yet.</p>}
              {dims.map((d) => (
                <div key={d.name} className="t-dim">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-t-soft-mute">{d.name.replace(/_/g, " ")}</span>
                    <span className="text-xs font-bold text-t-text">
                      {(d.score * 100).toFixed(0)}%
                      <span className="font-normal text-t-mute"> · conf {(d.confidence * 100).toFixed(0)}</span>
                    </span>
                  </div>
                  <div className="t-dim-bar">
                    <i style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="t-card-deep t-card p-6">
            <p className="t-eyebrow t-eyebrow-purple">Diagnosis</p>
            <h3 className="mt-2 text-lg font-bold">{result.diagnosis.archetype.replace(/_/g, " ")}</h3>
            <p className="t-muted mt-2">
              {result.diagnosis.gap_origin}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {delays.length > 0 ? (
                delays.slice(0, 4).map((d) => (
                  <span key={d.name} className="t-pill t-pill-warn">
                    {d.name.replace(/_/g, " ")} low
                  </span>
                ))
              ) : (
                <span className="t-pill t-pill-good">Signals stable</span>
              )}
            </div>
            {result.contradictions.length > 0 && (
              <div className="mt-6 border-t border-t-line pt-4">
                <p className="t-eyebrow t-eyebrow-red mb-2">Contradictions</p>
                {result.contradictions.map((c, i) => (
                  <p key={i} className="t-muted text-[11px]">
                    {c.description}
                  </p>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      {/* 3 · HOW TO REACH THE NEXT SCORE */}
      <section className="mx-auto mt-8 max-w-6xl">
        <p className="t-eyebrow-green t-eyebrow">3 · How to reach the next score</p>
        <h2 className="t-h2 mt-1">One clear improvement, then a path</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="t-card p-6">
            <span className="t-pill t-pill-good">Highest impact · family {result.recommendation.family}</span>
            <h3 className="mt-3 text-lg font-bold">{result.recommendation.exposure}</h3>
            <p className="t-muted mt-2">
              {learner.recommendation.focus}
            </p>
            {result.recommendation.next_probe && (
              <p className="t-muted mt-3 text-[11px]">
                Next probe: {result.recommendation.next_probe}
              </p>
            )}
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-t-mute">Priority</span>
              <div className="w-40">
                <div className="t-progress">
                  <i style={{ width: `${Math.round(result.recommendation.priority * 100)}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold">{(result.recommendation.priority * 100).toFixed(0)}</span>
            </div>
          </article>

          <article className="t-card p-6">
            <p className="t-eyebrow t-eyebrow-orange">Next steps</p>
            <ul className="mt-3 space-y-3">
              {learner.summary.next_steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-t-soft-mute">
                  <span className="text-t-cyan">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
              {(result.recommendation.exposure ?? "").length > 0 && (
                <li className="flex gap-3 text-sm text-t-soft-mute">
                  <span className="text-t-cyan">✓</span>
                  <span>Build towards the B2.2 stable band through focused practice on the exposure plan.</span>
                </li>
              )}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}