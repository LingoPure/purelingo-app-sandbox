import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GapRadar } from "@/components/dashboard/gap-radar";
import { RescoreButton } from "@/components/dashboard/rescore-button";

const SKILLS = [
  { key: "speaking_fluency", label: "Speaking" },
  { key: "listening_comprehension", label: "Listening" },
  { key: "writing_formal", label: "Writing" },
  { key: "reading_intent", label: "Reading intent" },
  { key: "business_vocabulary", label: "Vocabulary" },
  { key: "presentation_delivery", label: "Presenting" },
] as const;

type SkillKey = (typeof SKILLS)[number]["key"];
type ScoreRow = { skill: string; score: number; target: number | null };

type CefrBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type SubScoreEvidence = {
  score: number;
  cefr_band: CefrBand;
  evidence: string;
};

type ProfileJson = {
  speaking_fluency: SubScoreEvidence;
  listening_comprehension: SubScoreEvidence;
  writing_formal: SubScoreEvidence;
  reading_intent: SubScoreEvidence;
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

  const [studentResult, scoresResult, sessionResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, discovery_status, target_level")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("gap_scores")
      .select("skill, score, target")
      .eq("student_id", user!.id),
    supabase
      .from("discovery_sessions")
      .select("profile_json, completed_at, status")
      .eq("student_id", user!.id)
      .eq("status", "complete")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const student = studentResult.data;
  const scores = (scoresResult.data ?? []) as ScoreRow[];
  const profile = (sessionResult.data?.profile_json ?? null) as ProfileJson | null;

  const scoreMap = new Map<string, ScoreRow>(scores.map((s) => [s.skill, s]));
  const radarSkills = SKILLS.map((s) => {
    const row = scoreMap.get(s.key);
    return {
      key: s.key,
      label: s.label,
      score: row?.score ?? null,
      target: row?.target ?? 80,
    };
  });

  const discoveryComplete = student?.discovery_status === "complete";
  const hasScores = scores.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Student dashboard
          </p>
          <h1 className="font-serif text-3xl text-navy">Your gap profile</h1>
        </div>
        {hasScores && <RescoreButton />}
      </div>

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
            <CefrBadge label="Now" band={profile.overall_cefr} tone="current" />
            <CefrBadge label="Target" band={profile.target_level} tone="target" />
          </div>
          <p className="font-serif text-lg leading-relaxed text-navy">
            {profile.summary}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl text-navy">Skills</h2>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            Target line: {student?.target_level ?? "B2"} · 80
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
              return (
                <ScoreBar
                  key={s.key}
                  label={s.label}
                  score={row?.score ?? null}
                  target={row?.target ?? 80}
                  band={sub?.cefr_band}
                  evidence={sub?.evidence}
                />
              );
            })}
          </div>
        </div>
        {!hasScores && discoveryComplete && (
          <p className="mt-5 text-sm text-mute">
            Discovery complete but scoring hasn&apos;t finished yet. Try{" "}
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-navy">
              Re-score
            </span>{" "}
            in the top right.
          </p>
        )}
        {!hasScores && !discoveryComplete && (
          <p className="mt-5 text-sm text-mute">
            No scores yet — complete your discovery session to see your initial gap profile.
          </p>
        )}
      </section>

      {profile && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ProfileCard
            heading="Why this target"
            tag={`Target · ${profile.target_level}`}
            body={profile.target_why}
          />
          <ProfileCard
            heading="How you learn"
            tag="Learning style"
            body={profile.learning_style_notes}
          />
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NextClassCard />
        <ActivityLogCard />
      </section>
    </div>
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
  evidence?: string;
}) {
  const pct = score ?? 0;
  const colour =
    score == null
      ? "bg-cream"
      : score < 40
      ? "bg-coral"
      : score < 70
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
              style={{ left: `${target}%` }}
              aria-label={`Target ${target}`}
            />
          )}
        </div>
        <span className="w-16 text-right font-mono text-xs text-mute">
          {score == null ? "—" : `${score} · ${band ?? ""}`}
        </span>
      </div>
      {evidence && (
        <details className="group pl-[7.75rem]">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-mute hover:text-navy">
            Evidence
          </summary>
          <p className="mt-1.5 border-l-2 border-cream pl-3 text-xs italic text-mute">
            {evidence}
          </p>
        </details>
      )}
    </div>
  );
}

function CefrBadge({
  label,
  band,
  tone,
}: {
  label: string;
  band: CefrBand;
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
      <span className="font-serif text-base">{band}</span>
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

function NextClassCard() {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <h3 className="mb-2 font-serif text-lg text-navy">Next class</h3>
      <p className="text-sm text-mute">
        No class scheduled — contact your coordinator to be assigned a teacher and slot.
      </p>
    </div>
  );
}

function ActivityLogCard() {
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
