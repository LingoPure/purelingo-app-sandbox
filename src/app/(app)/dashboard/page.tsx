import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const SKILLS = [
  { key: "speaking_fluency", label: "Speaking fluency" },
  { key: "listening_comprehension", label: "Listening" },
  { key: "writing_formal", label: "Writing — formal" },
  { key: "reading_intent", label: "Reading intent" },
  { key: "business_vocabulary", label: "Business vocabulary" },
  { key: "presentation_delivery", label: "Presentation" },
] as const;

type ScoreRow = { skill: string; score: number; target: number | null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: student } = await supabase
    .from("students")
    .select("id, discovery_status, target_level")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: scores } = await supabase
    .from("gap_scores")
    .select("skill, score, target")
    .eq("student_id", user!.id);

  const scoreMap = new Map<string, ScoreRow>();
  (scores ?? []).forEach((s) => scoreMap.set(s.skill, s as ScoreRow));

  const discoveryComplete = student?.discovery_status === "complete";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          Student dashboard
        </p>
        <h1 className="font-serif text-3xl text-navy">Your gap profile</h1>
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

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl text-navy">Skills</h2>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            Target: {student?.target_level ?? "B2"}
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {SKILLS.map((s) => {
            const row = scoreMap.get(s.key);
            return (
              <ScoreBar
                key={s.key}
                label={s.label}
                score={row?.score ?? null}
                target={row?.target ?? 80}
              />
            );
          })}
        </div>
        {!scores?.length && (
          <p className="mt-5 text-sm text-mute">
            No scores yet — complete your discovery session to see your initial gap profile.
          </p>
        )}
      </section>

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
}: {
  label: string;
  score: number | null;
  target: number;
}) {
  const pct = score ?? 0;
  const colour = score == null
    ? "bg-cream"
    : score < 40
    ? "bg-coral"
    : score < 70
    ? "bg-amber"
    : "bg-ai-green";

  return (
    <div className="flex items-center gap-4">
      <span className="w-44 text-sm text-ink">{label}</span>
      <div className="relative flex-1 overflow-hidden rounded-full bg-cream">
        <div className={`h-2 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
        {target > 0 && (
          <div
            className="absolute top-0 h-2 w-px bg-navy"
            style={{ left: `${target}%` }}
            aria-label={`Target ${target}`}
          />
        )}
      </div>
      <span className="w-14 text-right font-mono text-xs text-mute">
        {score == null ? "—" : `${score}/100`}
      </span>
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
