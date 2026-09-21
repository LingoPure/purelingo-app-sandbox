import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GapRadar } from "@/components/dashboard/gap-radar";
import { ScheduleClassButton } from "@/components/dashboard/schedule-class-button";
import {
  CertificationCard,
  type LatestCert,
} from "@/components/dashboard/certification-card";
import { GamificationCard } from "@/components/dashboard/gamification-card";
import { JustFinishedBanner } from "@/components/dashboard/just-finished-banner";
import { RecommendedPlan } from "@/components/dashboard/recommended-plan";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { generateLessonPlan } from "@/lib/lessons/plan-generator";
import { computeEligibility } from "@/lib/tracktest/eligibility";
import {
  SKILL_KEYS,
  SUPPORTING_SKILL_KEYS,
  SKILL_LABELS,
  scoreToLp18,
  scoreToCefrBand,
  type SkillKey,
  type CefrBand,
} from "@/lib/scoring/rubric";
import { readClassinCredentials } from "@/lib/classin/token";
import { bilingualize, type Bilingual } from "@/lib/i18n/translate";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/dictionary";
import { BilingualText } from "@/components/i18n/bilingual-text";
import { tierForTarget } from "@/lib/gamification/rules";
import { getDict } from "@/lib/i18n";

/** The six PRIMARY, CEFR-mapped dimensions — the radar + headline bars. */
const SKILLS = SKILL_KEYS.map((key) => ({ key, label: SKILL_LABELS[key] }));

/** The two supporting/secondary measures — own section, never the radar. */
const SUPPORTING_SKILLS = SUPPORTING_SKILL_KEYS.map((key) => ({
  key,
  label: SKILL_LABELS[key],
}));

type ScoreRow = { skill: string; score: number; target: number | null };

type SubScoreEvidence = {
  score: number;
  cefr_band: CefrBand;
  evidence: string;
};

type NextClass = {
  id: string;
  scheduled_at: string | null;
  teacher_name: string | null;
  status: string | null;
};

type RecentClass = {
  id: string;
  scheduled_at: string | null;
  teacher_name: string | null;
  status: string | null;
  transcribed_at: string | null;
};

type ProfileJson = {
  speaking: SubScoreEvidence;
  listening: SubScoreEvidence;
  writing: SubScoreEvidence;
  reading: SubScoreEvidence;
  grammar: SubScoreEvidence;
  live_interaction: SubScoreEvidence;
  business_vocabulary: SubScoreEvidence;
  presentation_delivery: SubScoreEvidence;
  overall_cefr: CefrBand;
  target_level: CefrBand;
  target_why: string;
  learning_style_notes: string;
  summary: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A user who is ALSO an employer admin sees the learner dashboard here (no
  // blank-flash bounce to /employer). The "Employer console" link in the app
  // nav takes them to /employer when they want it — so a dual-role demo user
  // can walk the full learner flow AND reach the admin console.

  const [
    studentResult,
    scoresResult,
    sessionResult,
    nextClassResult,
    recentClassesResult,
    lessonsResult,
    certsResult,
    nudgesResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, name, discovery_status, target_level, xp, streak_days, native_language"
      )
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("gap_scores")
      .select("skill, score, target")
      .eq("student_id", user!.id)
      .eq("is_canonical", true),
    supabase
      .from("discovery_sessions")
      .select("profile_json, completed_at, status")
      .eq("student_id", user!.id)
      .eq("status", "complete")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("classin_sessions")
      .select("id, scheduled_at, teacher_name, status")
      .eq("student_id", user!.id)
      .in("status", ["scheduled", "live"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("classin_sessions")
      .select("id, scheduled_at, teacher_name, status, transcribed_at")
      .eq("student_id", user!.id)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("micro_lessons")
      .select("xp_awarded, status")
      .eq("student_id", user!.id),
    supabase
      .from("certifications")
      .select("id, level, status, issued_at, created_at")
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("nudges")
      .select("id, rule, subject, body, sent_at, created_at, delivery_status")
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const student = studentResult.data;
  const scores = (scoresResult.data ?? []) as ScoreRow[];
  const profile = (sessionResult.data?.profile_json ?? null) as ProfileJson | null;

  // Live overall band/LP-18, from the SAME source (live gap_scores) and the
  // SAME formula (scoreToCefrBand/scoreToLp18) the Skills list below already
  // uses — never the frozen discovery_sessions.profile_json snapshot, which
  // battery reconciliation can leave stale relative to the canonical rows
  // (ISS-047). profile_json is still used for the narrative summary/target_why,
  // which have no live equivalent.
  const liveAssessedScores = scores
    .map((s) => s.score)
    .filter((s): s is number => s != null);
  const liveAvgScore =
    liveAssessedScores.length > 0
      ? liveAssessedScores.reduce((a, b) => a + b, 0) / liveAssessedScores.length
      : null;
  const liveOverallBand: CefrBand | null =
    liveAvgScore != null ? scoreToCefrBand(liveAvgScore) : null;
  const liveOverallLp18 = liveAvgScore != null ? scoreToLp18(liveAvgScore) : null;

  // One target level, read once, used everywhere on this page (badge + the
  // "Target line" caption below) so they can't diverge (ISS-050). Prefer the
  // live students.target_level (can be updated independently of the frozen
  // discovery profile) and fall back to the profile snapshot.
  const targetLevel: CefrBand =
    (student?.target_level as CefrBand | undefined) ??
    profile?.target_level ??
    "B2";

  const nextClass = nextClassResult.data as NextClass | null;
  const recentClasses = (recentClassesResult.data ?? []) as RecentClass[];
  const lessons = (lessonsResult.data ?? []) as { xp_awarded: number | null; status: string | null }[];
  const totalXp = lessons.reduce((sum, l) => sum + (l.xp_awarded ?? 0), 0);
  const completedLessons = lessons.filter((l) => l.status === "completed").length;

  const certs = (certsResult.data ?? []) as {
    id: string;
    level: string;
    status: string;
    issued_at: string | null;
    created_at: string;
  }[];
  const nudges = (nudgesResult.data ?? []) as {
    id: string;
    rule: string | null;
    subject: string | null;
    body: string | null;
    sent_at: string | null;
    created_at: string;
    delivery_status: string | null;
  }[];
  const latestPassed = certs.find((c) => c.status === "passed") ?? null;
  const pending = certs.find(
    (c) => c.status === "scheduled" || c.status === "in_progress"
  );
  const latestCert: LatestCert = latestPassed ?? null;
  const pendingCertId = pending?.id ?? null;

  const eligibilityScores = Object.fromEntries(
    SKILL_KEYS.map((k) => [k, null as number | null])
  );
  for (const s of scores) {
    if ((SKILL_KEYS as readonly string[]).includes(s.skill)) {
      eligibilityScores[s.skill] = s.score;
    }
  }
  const eligibility = computeEligibility(
    eligibilityScores as Parameters<typeof computeEligibility>[0]
  );

  const scoreMap = new Map<string, ScoreRow>(scores.map((s) => [s.skill, s]));
  const radarSkills = SKILLS.map((s) => {
    const row = scoreMap.get(s.key);
    return {
      key: s.key,
      label: s.label,
      score: row?.score ?? null,
      target: row?.target ?? 800,
    };
  });

  const discoveryComplete = student?.discovery_status === "complete";
  const hasScores = scores.length > 0;

  // Progress trail (read-only) for the score-over-time chart. RLS limits this to the
  // student's own rows. Only queried when there are scores to chart.
  let progressHistory: { skill: string; score: number; scored_at: string }[] = [];
  if (hasScores) {
    const { data: histData } = await supabase
      .from("gap_score_history")
      .select("skill, score, scored_at")
      .eq("student_id", user!.id)
      .order("scored_at", { ascending: true });
    progressHistory = (histData ?? []) as typeof progressHistory;
  }

  const lessonPlan = hasScores
    ? await generateLessonPlan(supabase, user!.id)
    : [];

  // Bilingual rendering for the two student-facing dynamic surfaces:
  //   - per-skill evidence on the gap-score bars
  //   - per-recommendation rationale on the lesson-plan card
  // One Claude call per page render translates everything; English is
  // shown alongside as deliberate cross-reading practice.
  const studentNative = (student as { native_language?: string } | null)
    ?.native_language;
  const targetLang: LanguageCode | null = isLanguageCode(studentNative)
    ? studentNative
    : null;
  // Evidence for the 6 primary dimensions AND the 2 supporting signals — one
  // combined key list so both the radar bars and the Supporting signals
  // section below get bilingual evidence text.
  const allSkillKeys = [...SKILL_KEYS, ...SUPPORTING_SKILL_KEYS];
  const evidenceStrings = allSkillKeys.map((k) => profile?.[k]?.evidence ?? "");
  const planStrings = lessonPlan.map((r) => r.rationale);
  const summaryString = profile?.summary ?? "";
  const [evidenceBilingual, planBilingual, summaryBilingual] = await Promise.all([
    bilingualize(evidenceStrings, targetLang),
    bilingualize(planStrings, targetLang),
    bilingualize([summaryString], targetLang).then((arr) => arr[0]),
  ]);
  const evidenceByKey = new Map<string, Bilingual>(
    allSkillKeys.map((k, i) => [k, evidenceBilingual[i]])
  );
  const planWithBilingual = lessonPlan.map((rec, i) => ({
    ...rec,
    rationaleBilingual: planBilingual[i],
  }));

  const { lang, t } = await getDict();
  const studentXp = (student as { xp?: number | null } | null)?.xp ?? 0;
  const studentStreak =
    (student as { streak_days?: number | null } | null)?.streak_days ?? 0;
  const studentTier = tierForTarget(student?.target_level);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Student dashboard
          </p>
          <h1 className="font-serif text-3xl text-navy">Your gap profile</h1>
        </div>
        {hasScores && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/dashboard/journey"
              title="Journey view — how your communication state develops across 2K assessments, with evidence, focus behaviours and drift alerts."
              className="rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-navy transition hover:bg-gold/20"
            >
              Journey view
            </Link>
            <Link
              href="/onboarding"
              title="See where you are now versus before. Starts a fresh check-in with Aria and re-measures your level — use it when your role changes or your English moves on. Past scores are kept so you and your employer can track progress."
              className="rounded-md border border-navy bg-navy px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition hover:bg-navy-deep"
            >
              Progress check-in
            </Link>
          </div>
        )}
      </div>

      <JustFinishedBanner hasScores={hasScores} />

      <GamificationCard
        xp={studentXp}
        streakDays={studentStreak}
        tier={studentTier}
        lang={lang}
        labels={{
          title: t("gamify.title"),
          xp: t("gamify.xp"),
          streak: t("gamify.streak"),
          streakUnit: t("gamify.streakUnit"),
          streakUnitOne: t("gamify.streakUnitOne"),
          cta: t("gamify.cta"),
        }}
      />

      {!discoveryComplete && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-6">
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-gold">
            Step 1 — Required
          </p>
          <h2 className="mb-2 font-serif text-xl text-navy">
            Complete your discovery session
          </h2>
          <p className="mb-4 text-sm text-mute">
            A 20–35 minute voice conversation establishes your baseline fluency, your role,
            and your target level. Everything else flows from this.
          </p>
          <Link
            href="/onboarding"
            className="inline-block rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
          >
            Start discovery →
          </Link>
        </div>
      )}

      {profile && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <CefrBadge
              label="Now"
              band={liveOverallBand ?? profile.overall_cefr}
              lp18={liveOverallLp18 ?? undefined}
              tone="current"
            />
            {/* Target is a threshold, not a measured value — show the plain
                CEFR letter only. Fabricating an LP-18 micro-band for it
                (e.g. via a hardcoded score constant) is what produced the
                "C2.1 target" bug (ISS-050): a CEFR letter spans 3 micro-bands,
                so there is no single correct sub-band to invent for a goal. */}
            <CefrBadge label="Target" band={targetLevel} tone="target" />
          </div>
          <BilingualText
            text={summaryBilingual}
            className="font-serif text-lg leading-relaxed text-navy"
          />
        </section>
      )}

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl text-navy">Skills</h2>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            Target line: {targetLevel} · 800
          </span>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[360px_1fr]">
          <div className="flex justify-center">
            <GapRadar skills={radarSkills} />
          </div>
          <div className="flex flex-col gap-4">
            {SKILLS.map((s) => {
              const row = scoreMap.get(s.key);
              const sub = profile ? profile[s.key as SkillKey] : null;
              const evidenceBi = evidenceByKey.get(s.key);
              return (
                <ScoreBar
                  key={s.key}
                  label={s.label}
                  score={row?.score ?? null}
                  target={row?.target ?? 800}
                  band={sub?.cefr_band}
                  evidence={
                    sub?.evidence
                      ? evidenceBi ?? { native: sub.evidence, en: sub.evidence, translated: false }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
        {!hasScores && discoveryComplete && (
          <p className="mt-5 text-sm text-mute">
            Discovery complete — scoring is being finalised. If your scores don&apos;t
            appear shortly, run a fresh{" "}
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-navy">
              Progress check-in
            </span>{" "}
            from the top right.
          </p>
        )}
        {!hasScores && !discoveryComplete && (
          <p className="mt-5 text-sm text-mute">
            No scores yet — complete your discovery session to see your initial gap profile.
          </p>
        )}
      </section>

      {hasScores && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-5">
            <h2 className="font-serif text-xl text-navy">Supporting signals</h2>
            <p className="mt-1 text-sm text-mute">
              Secondary measures — they inform your plan but aren&apos;t part of your
              CEFR band above.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {SUPPORTING_SKILLS.map((s) => {
              const row = scoreMap.get(s.key);
              const sub = profile ? profile[s.key] : null;
              const evidenceBi = evidenceByKey.get(s.key);
              return (
                <ScoreBar
                  key={s.key}
                  label={s.label}
                  score={row?.score ?? null}
                  target={row?.target ?? 800}
                  band={sub?.cefr_band}
                  evidence={
                    sub?.evidence
                      ? evidenceBi ?? { native: sub.evidence, en: sub.evidence, translated: false }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {hasScores && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-navy">Progress over time</h2>
            <p className="mt-1 text-sm text-mute">
              How your scores have moved across check-ins. Each Progress check-in adds a
              point to the trend; lessons nudge individual skills between check-ins.
            </p>
          </div>
          <ProgressChart history={progressHistory} skills={SKILLS} />
        </section>
      )}

      {profile && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ProfileCard
            heading="Why this target"
            tag={`Target · ${targetLevel}`}
            body={profile.target_why}
          />
          <ProfileCard
            heading="How you learn"
            tag="Learning style"
            body={profile.learning_style_notes}
          />
        </section>
      )}

      {hasScores && <RecommendedPlan recommendations={planWithBilingual} />}

      {hasScores && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-emerald-900">
                Your improvement programme is ready
              </h2>
              <p className="mt-1 max-w-prose text-sm text-emerald-800">
                Sit down with Aria to walk through your scores, the rationale,
                and the 16-week plan — then commit to it.
              </p>
            </div>
            <Link
              href="/plan"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              View &amp; commit
            </Link>
          </div>
        </section>
      )}

      <CertificationCard
        eligibility={eligibility}
        latestCert={latestCert}
        pendingCertId={pendingCertId}
      />

      <PracticeCard totalXp={totalXp} completedLessons={completedLessons} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NextClassCard
          nextClass={nextClass}
          classinConnected={readClassinCredentials() !== null}
        />
        <ActivityLogCard recentClasses={recentClasses} />
      </section>

      {nudges.length > 0 && <NudgesCard nudges={nudges} />}
    </div>
  );
}

function NudgesCard({
  nudges,
}: {
  nudges: {
    id: string;
    rule: string | null;
    subject: string | null;
    body: string | null;
    sent_at: string | null;
    created_at: string;
    delivery_status: string | null;
  }[];
}) {
  return (
    <section className="rounded-lg border border-cream bg-paper p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg text-navy">From your coach</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
          Aria · automated
        </span>
      </div>
      <ul className="flex flex-col gap-4">
        {nudges.map((n) => {
          const when = new Date(n.sent_at ?? n.created_at).toLocaleDateString(
            "en-AU",
            { month: "short", day: "numeric" }
          );
          return (
            <li key={n.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-ink">{n.subject ?? ""}</p>
                <span className="font-mono text-[10px] text-mute">{when}</span>
              </div>
              {n.body && (
                <p className="text-sm leading-relaxed text-mute">{n.body}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PracticeCard({
  totalXp,
  completedLessons,
}: {
  totalXp: number;
  completedLessons: number;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-cream bg-paper p-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Practice
        </p>
        <h3 className="font-serif text-lg text-navy">
          {completedLessons === 0
            ? "Try a five-minute lesson"
            : `${completedLessons} lesson${completedLessons === 1 ? "" : "s"} done · ${totalXp} XP`}
        </h3>
        <p className="mt-1 max-w-xl text-sm text-mute">
          Email sprints calibrated to your gap profile. Each one updates your scores in real time.
        </p>
      </div>
      <Link
        href="/lessons"
        className="inline-block rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
      >
        {completedLessons === 0 ? "Start a lesson →" : "Continue practicing →"}
      </Link>
    </section>
  );
}

function ScoreBar({
  label,
  score,
  target,
  band,
  evidence,
}: {
  label: string;
  score: number | null;
  target: number;
  band?: CefrBand;
  evidence?: Bilingual;
}) {
  const SCALE_MAX = 1000;
  const pct = score == null ? 0 : (score / SCALE_MAX) * 100;
  const targetPct = (target / SCALE_MAX) * 100;
  const colour =
    score == null
      ? "bg-cream"
      : score < 400
      ? "bg-coral"
      : score < 700
      ? "bg-amber"
      : "bg-ai-green";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <span className="w-28 text-sm text-ink">{label}</span>
        <div className="relative flex-1 overflow-hidden rounded-full bg-cream">
          <div
            className={`h-2 rounded-full ${colour}`}
            style={{ width: `${pct}%` }}
          />
          {target > 0 && (
            <div
              className="absolute top-0 h-2 w-px bg-navy"
              style={{ left: `${targetPct}%` }}
              aria-label={`Target ${target}`}
            />
          )}
        </div>
        <span className="w-24 text-right font-mono text-xs text-mute">
          {score == null ? "—" : `${score} · ${scoreToLp18(score)}`}
        </span>
      </div>
      {(evidence || band) && (
        <details className="group pl-[7.75rem]">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-mute hover:text-navy">
            Evidence
          </summary>
          <div className="mt-1.5 flex flex-col gap-1 border-l-2 border-cream pl-3 text-xs text-mute">
            {band && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                Model assessment: {band}
              </p>
            )}
            {evidence && (
              <BilingualText
                text={evidence}
                className="text-xs italic text-mute"
                englishLabel="EN"
              />
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function CefrBadge({
  label,
  band,
  lp18,
  tone,
}: {
  label: string;
  band: CefrBand;
  /** LP-18 micro-band, e.g. "B2.3". Omit for a threshold value (a target) —
   * a CEFR letter spans 3 micro-bands, so there is no single correct
   * sub-band to show for a goal rather than a measurement. */
  lp18?: string;
  tone: "current" | "target";
}) {
  const styles =
    tone === "current"
      ? "border-teal/30 bg-teal/5 text-teal"
      : "border-navy/30 bg-navy/5 text-navy";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${styles}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
        {label}
      </span>
      <span className="font-serif text-base">{lp18 ?? band}</span>
      {lp18 && (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-mute sm:inline">
          {band}
        </span>
      )}
    </span>
  );
}

function ProfileCard({
  heading,
  tag,
  body,
}: {
  heading: string;
  tag: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
        {tag}
      </p>
      <h3 className="mb-2 font-serif text-lg text-navy">{heading}</h3>
      <p className="text-sm leading-relaxed text-ink">{body}</p>
    </div>
  );
}

function NextClassCard({
  nextClass,
  classinConnected,
}: {
  nextClass: NextClass | null;
  classinConnected: boolean;
}) {
  if (!nextClass) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-cream bg-paper p-6">
        <h3 className="font-serif text-lg text-navy">Next class</h3>
        <p className="text-sm text-mute">
          No class scheduled — your coordinator will assign a teacher and slot. For demo
          purposes you can schedule one yourself below.
        </p>
        <ScheduleClassButton connected={classinConnected} />
      </div>
    );
  }

  const when = nextClass.scheduled_at
    ? new Date(nextClass.scheduled_at).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Time TBC";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream bg-paper p-6">
      <h3 className="font-serif text-lg text-navy">Next class</h3>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          {when}
        </p>
        <p className="mt-1 text-sm text-ink">
          With {nextClass.teacher_name ?? "your coach"}
        </p>
      </div>
      <Link
        href={`/classroom/${nextClass.id}`}
        className="inline-block rounded-md bg-navy px-4 py-2 text-center text-sm font-medium text-paper hover:bg-navy-deep"
      >
        Enter class →
      </Link>
    </div>
  );
}

function ActivityLogCard({ recentClasses }: { recentClasses: RecentClass[] }) {
  if (recentClasses.length === 0) {
    return (
      <div className="rounded-lg border border-cream bg-paper p-6">
        <h3 className="mb-2 font-serif text-lg text-navy">Recent activity</h3>
        <p className="text-sm text-mute">
          Activity will appear here as you complete your discovery, attend classes, and finish
          micro-lessons.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <h3 className="mb-3 font-serif text-lg text-navy">Recent classes</h3>
      <ul className="flex flex-col gap-3">
        {recentClasses.map((c) => {
          const when = c.scheduled_at
            ? new Date(c.scheduled_at).toLocaleDateString("en-AU", {
                month: "short",
                day: "numeric",
              })
            : "—";
          const scored = Boolean(c.transcribed_at);
          return (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  {c.teacher_name ?? "Coach"} · {when}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                  {scored ? "Scored" : "Awaiting score"}
                </p>
              </div>
              {!scored && (
                <Link
                  href={`/classroom/${c.id}/transcribe`}
                  className="shrink-0 rounded-md border border-navy/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:bg-mist"
                >
                  Score session
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
