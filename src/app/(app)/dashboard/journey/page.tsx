// @explanatory-header-exempt — the journey page carries the assessment-tel header below
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadResultHistory, loadLatestPipeline } from "@/lib/2k/journey-data";
import { buildLearnerDeliveryView } from "@/lib/2k/learner-delivery";
import { ScoreRing } from "@/components/telemetry/score-ring";
import { TRadar } from "@/components/telemetry/radar";
import { TProgress } from "@/components/telemetry/score-ring";
import { LearnerNotes } from "@/components/telemetry/learner-notes";
import { tierForTarget } from "@/lib/gamification/rules";
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

const BAND_INDEX: Record<string, number> = {
  Survival: 0,
  Functional: 1,
  Professional: 2,
  "Stable Professional": 3,
  "Executive Stability": 4,
  "Strategic Mastery": 5,
};

function capLabel(address: string): string {
  return CAPABILITY_LABELS[address] ?? address.replace(/_/g, " ");
}

export default async function LearnerJourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: student } = await supabase
    .from("students")
    .select("id, name, native_language, target_level, xp, streak_days, discovery_status")
    .eq("id", user.id)
    .maybeSingle();

  const [history, latest] = await Promise.all([
    loadResultHistory(supabase, user.id, 20),
    loadLatestPipeline(supabase, user.id),
  ]);

  const name = (student as { name?: string } | null)?.name ?? "Phuong";
  const native = (student as { native_language?: string } | null)?.native_language ?? "en";
  const targetLevel = (student as { target_level?: string } | null)?.target_level ?? "B2.2";

  const latestView = latest ? buildLearnerDeliveryView(latest.result) : null;
  const result = latest?.result ?? null;

  // Timeline: LP-1000 score + band per completed assessment, newest first
  // (render oldest → newest). Achievements = band transitions.
  const timeline = [...history].reverse().map((p, i) => ({
    idx: i,
    when: new Date(p.result.frozen_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    score: p.result.lp1000.score,
    band: p.result.lp1000.band,
    bandIndex: BAND_INDEX[p.result.lp1000.band] ?? 0,
    label: `${p.result.lp1000.score} · ${p.result.lp1000.band}`,
  }));

  const bandTransitions = timeline.filter(
    (t, i) => i === 0 || t.bandIndex !== timeline[i - 1].bandIndex
  ).length;

  const radarSkills = (latestView?.capabilities ?? []).slice(0, 6).map((c) => ({
    key: c.address,
    label: capLabel(c.address),
    score: c.score,
    target: 800,
  }));

  const dims = (result?.telemetry.dimensions ?? []).map((d) => ({
    ...d,
    pct: Math.round(d.score * 100),
  }));
  const lowDims = dims.filter((d) => d.score < 0.55).slice(0, 3);
  const highDims = dims.slice().sort((a, b) => b.score - a.score).slice(0, 3);

  const moveTogether =
    lowDims.length >= 2
      ? [
          `Improve ${lowDims[0].name.replace(/_/g, " ")} and ${lowDims[1].name.replace(/_/g, " ")} together — they share the same trigger moment.`,
          `Each of these signals feeds the ${result?.diagnosis.archetype ?? "CAPABILITY"} gap directly. One targeted practice lifts both.`,
          `Confirm the shared frame before moving on — the highest-leverage behaviour for both.`,
        ]
      : [
          "Your telemetry signals are stable — keep the current focused practice.",
          "One clear behaviour, repeated across three work situations, moves several scores at once.",
          "Confirm the shared frame before moving on — highest leverage when signals start to slip.",
        ];

  const streak = (student as { streak_days?: number } | null)?.streak_days ?? 0;
  const xp = (student as { xp?: number } | null)?.xp ?? 0;
  const tier = tierForTarget(targetLevel);

  return (
    <div className="telemetry min-h-screen p-4 pb-12 sm:p-6 lg:p-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="t-eyebrow-green t-eyebrow">Your communication journey, made visible</p>
          <h1 className="mt-1 font-serif text-2xl text-t-soft sm:text-3xl">
            {name}&apos;s communication journey, made visible.
          </h1>
          <p className="t-muted mt-1">
            Track how your communication state changes across projects, teams, and time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-pill">Target {targetLevel}</span>
          <span className="t-pill">{native} · {history.length} assessment{history.length === 1 ? "" : "s"}</span>
          <Link
            href="/dashboard"
            className="rounded-lg border border-t-line px-3 py-2 text-xs font-medium text-t-soft-mute hover:border-t-cyan hover:text-t-text"
          >
            ← Classic dashboard
          </Link>
        </div>
      </div>

      {/* ── Hero + recommended next action ─────────────────────────────────── */}
      <section className="mx-auto mt-8 max-w-6xl">
        <div className="t-hero-grid">
          <article className="t-card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
            <div className="t-score-ring">
              <ScoreRing
                score={result?.lp1000.score ?? 0}
                color={result ? (BAND_COLORS[result.lp1000.band] ?? "#35c9ef") : "#20384a"}
              />
              <div className="t-score-inner">
                <strong style={{ color: result ? (BAND_COLORS[result.lp1000.band] ?? "#35c9ef") : "#91a8b8" }}>
                  {result?.lp1000.score ?? "—"}
                </strong>
                <span>LP-1000</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="t-eyebrow t-eyebrow-orange">Communication state</p>
              <h2 className="t-h2 mt-2">
                {latestView?.summary.strengths[0] ??
                  result?.diagnosis.gap_origin ??
                  "Your latest assessment sets the next milestone."}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result && (
                  <>
                    <span className="t-pill t-pill-good">{result.lp1000.band}</span>
                    <span className="t-pill">CEFR {result.lp18.stable.cefr_macro}</span>
                    <span className="t-pill">Confidence {(result.lp1000.confidence * 100).toFixed(0)}%</span>
                  </>
                )}
                {!result && <span className="t-pill">Awaiting first assessment</span>}
              </div>
            </div>
          </article>

          <article className="t-card p-6">
            <div className="flex items-center justify-between">
              <p className="t-eyebrow t-eyebrow-green">Recommended next action</p>
              <span className="t-pill t-pill-good">Highest impact</span>
            </div>
            <h3 className="mt-3 text-lg font-bold">
              {result
                ? (result.recommendation.exposure || "Keep the current focused practice")
                : "Complete your first 2K assessment"}
            </h3>
            <p className="t-muted mt-2">
              {result?.recommendation.next_probe ??
                latestView?.summary.next_steps[0] ??
                "One improvement at a time — the engine tells you which."}
            </p>
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-[11px] text-t-mute">Towards {targetLevel}</span>
              <div className="min-w-0 flex-1">
                <TProgress value={result ? Math.round((result.lp1000.score / 1000) * 100) : 0} />
              </div>
              <span className="text-[11px] font-bold">
                {result ? `${Math.round((result.lp1000.score / 1000) * 100)}%` : "0%"}
              </span>
            </div>
          </article>
        </div>
      </section>

      {/* ── Metric row ─────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-4 max-w-6xl">
        <div className="t-metrics">
          <div className="t-metric">
            <span>LP-1000</span>
            <strong style={{ color: "#35c9ef" }}>{result?.lp1000.score ?? "—"}</strong>
          </div>
          <div className="t-metric">
            <span>Confidence</span>
            <strong>{result ? `${(result.confidence * 100).toFixed(0)}%` : "—"}</strong>
          </div>
          <div className="t-metric">
            <span>Band transitions</span>
            <strong style={{ color: "#80d84d" }}>{bandTransitions}</strong>
          </div>
          <div className="t-metric">
            <span>Day streak</span>
            <strong style={{ color: "#ff9f1c" }}>{streak}</strong>
          </div>
        </div>
      </section>

      {/* ── 4D timeline + achievement journey ──────────────────────────────── */}
      <section className="mx-auto mt-8 max-w-6xl">
        <div className="t-hero-grid">
          <article className="t-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="t-eyebrow t-eyebrow-purple">4D communication progress</p>
              <div className="flex gap-2">
                <span className="t-pill">Target {targetLevel}</span>
                {bandTransitions > 0 && <span className="t-pill t-pill-good">{bandTransitions} band climb(s)</span>}
              </div>
            </div>
            <h2 className="t-h2 mt-2">How communication develops unevenly through time</h2>
            <div className="t-timeline mt-6">
              <div className="lane" />
              {timeline.length === 0 && (
                <p className="t-muted pt-4">Complete assessments to build your trajectory.</p>
              )}
              {timeline.map((t) => (
                <div key={t.idx} className={`stop band-${t.bandIndex}`} title={t.label}>
                  <span className="tag">{t.when}</span>
                  <span className="dot" />
                </div>
              ))}
            </div>
          </article>

          <article className="t-card p-6">
            <p className="t-eyebrow t-eyebrow-orange">The journey</p>
            <h2 className="t-h2 mt-2">Fast gains, plateaus, setbacks — and achievement</h2>
            <div className="t-journey-grid mt-4">
              {timeline.length === 0 && <p className="t-muted">No journey stops yet.</p>}
              {timeline.slice(-9).map((t) => (
                <div key={t.idx} className={`t-journey ${t.bandIndex >= 3 ? "done" : t.bandIndex >= 2 ? "hot" : ""}`}>
                  <p className="when">{t.when}</p>
                  <p className="band" style={{ color: BAND_COLORS[t.band] }}>
                    {t.band}
                  </p>
                  <p className="why">{t.score} LP-1000</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* ── Radar + evidence ───────────────────────────────────────────────── */}
      <section className="mx-auto mt-8 max-w-6xl">
        <div className="t-hero-grid">
          <article className="t-card p-6">
            <div className="flex items-center justify-between">
              <p className="t-eyebrow t-eyebrow-green">Your communication shape</p>
              <span className="t-pill">Simple view</span>
            </div>
            <h2 className="t-h2 mt-2">See the pattern without needing to understand the engine</h2>
            <div className="mt-4 flex justify-center">
              <TRadar skills={radarSkills} size={320} />
            </div>
          </article>

          <article className="t-card p-6">
            <p className="t-eyebrow t-eyebrow-purple">Behavioural evidence</p>
            <h2 className="t-h2 mt-2">What created this state</h2>
            <div className="mt-4 flex flex-col gap-3">
              {highDims.length > 0 ? (
                highDims.map((d) => (
                  <div key={d.name} className="t-evidence">
                    <p className="source">{d.name.replace(/_/g, " ")}</p>
                    <h4>Measured across responses</h4>
                    <p>{(d.score * 100).toFixed(0)}% signal strength · {(d.confidence * 100).toFixed(0)}% confidence</p>
                    <p className="change">{d.score >= 0.7 ? "Working for you" : "Building"}</p>
                  </div>
                ))
              ) : (
                <p className="t-muted">No telemetry signals recorded yet.</p>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* ── Weekly focus (multi-impact) + drift ────────────────────────────── */}
      <section className="mx-auto mt-8 max-w-6xl">
        <div className="t-hero-grid">
          <article className="t-card p-6">
            <p className="t-eyebrow t-eyebrow-orange">This week&apos;s focus</p>
            <h2 className="t-h2 mt-2">Three behaviours that move several scores at once</h2>
            <div className="mt-4 flex flex-col gap-3">
              {moveTogether.map((text, i) => (
                <div key={i} className="t-evidence" style={{ borderColor: "#29475a" }}>
                  <p className="source">0{i + 1} · {i === 0 ? "5 minutes" : i === 1 ? "today" : "this week"}</p>
                  <h4>{text.split(" — ")[0]}</h4>
                  <p>{text.split(" — ")[1] ?? text}</p>
                </div>
              ))}
            </div>
          </article>

          <div className="flex flex-col gap-4">
            <article className="t-card p-6">
              <div className="flex items-center justify-between">
                <p className="t-eyebrow t-eyebrow-red">What to do when alignment slips</p>
                <span className="t-pill">drift {(result?.telemetry.drift ?? 0) * 100 > 30 ? "watch" : "stable"}</span>
              </div>
              <h2 className="t-h2 mt-2">
                {(result?.telemetry.drift ?? 0) * 100 > 30
                  ? "Signals are drifting — re-anchor the frame."
                  : "Signals are stable — maintain the pattern."}
              </h2>
              <p className="t-muted mt-2">
                {(result?.telemetry.drift ?? 0) * 100 > 30
                  ? "Pause, confirm you are solving the same problem, then continue. Repair behaviour recovers alignment faster than re-explaining."
                  : lowDims.length > 0
                  ? `${lowDims.map((d) => d.name.replace(/_/g, " ")).join(", ")} are the first channels to slip. Watch them in live sessions.`
                  : "Keep responding on the same decision-first rhythm."}
              </p>
            </article>

            <article className="t-card p-6">
              <p className="t-eyebrow t-eyebrow-green">Right move, right moment</p>
              <h3 className="mt-2 text-lg font-bold">
                {result
                  ? `Family ${result.recommendation.family} — ${result.recommendation.exposure}`
                  : "Awaiting first assessment"}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-t-mute">Priority</span>
                <div className="w-40">
                  <TProgress value={(result?.recommendation.priority ?? 0) * 100} />
                </div>
                <span className="text-[11px] font-bold">
                  {result ? `${Math.round(result.recommendation.priority * 100)}` : "—"}
                </span>
              </div>
            </article>

            <article className="t-card p-6">
              <div className="flex items-center justify-between">
                <p className="t-eyebrow">Streak & XP</p>
                <span className="t-pill t-pill-good">Tier {tier} · keep the streak</span>
              </div>
              <div className="mt-3 flex items-center gap-6">
                <div>
                  <strong className="text-2xl font-extrabold text-t-orange">{xp}</strong>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-t-mute">XP</p>
                </div>
                <div>
                  <strong className="text-2xl font-extrabold text-t-green">{streak}</strong>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-t-mute">Day streak</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── My notes ───────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-8 max-w-6xl">
        <article className="t-card p-6">
          <div className="flex items-center justify-between">
            <p className="t-eyebrow t-eyebrow-purple">My notes</p>
            <span className="t-pill">private · visible to you only</span>
          </div>
          <h2 className="t-h2 mt-2">A field note for your next session</h2>
          <div className="mt-4">
            <LearnerNotes learnerId={user.id} />
          </div>
        </article>
      </section>
    </div>
  );
}