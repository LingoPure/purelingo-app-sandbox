import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StartLessonButton } from "./start-lesson-button";

type LessonRow = {
  id: string;
  type: string;
  status: string | null;
  xp_awarded: number | null;
  score_after: number | null;
  completed_at: string | null;
  created_at: string;
};

export default async function LessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lessons } = await supabase
    .from("micro_lessons")
    .select("id, type, status, xp_awarded, score_after, completed_at, created_at")
    .eq("student_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const totalXp = (lessons ?? []).reduce(
    (sum, l) => sum + ((l as LessonRow).xp_awarded ?? 0),
    0
  );

  const activeByType = new Map<string, LessonRow>();
  for (const l of (lessons ?? []) as LessonRow[]) {
    if (l.status === "active" && !activeByType.has(l.type)) {
      activeByType.set(l.type, l);
    }
  }
  const activeEmailSprint = activeByType.get("email_sprint") ?? null;
  const activeSpeakScore = activeByType.get("speak_score") ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          Micro-lessons
        </p>
        <h1 className="font-serif text-3xl text-navy">Practice between classes</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Five-minute writing sprints calibrated to your gap profile. Each one updates
          your scores in real time and earns XP. We&apos;ll add more lesson types as we go.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LessonTypeCard
          kicker="Email sprint"
          heading="Write a business email under time pressure"
          body="We generate a fresh scenario based on your role and current writing score. You have ~5 minutes to draft. Claude scores it and shows you a model rewrite."
          activeId={activeEmailSprint?.id}
          startType="email_sprint"
        />
        <LessonTypeCard
          kicker="Speak & score"
          heading="Record a 60–90 second business response"
          body="A scenario tailored to your speaking score and role. You record live in the browser — Whisper transcribes, Claude scores fluency, vocabulary and presentation."
          activeId={activeSpeakScore?.id}
          startType="speak_score"
        />
      </section>

      {(lessons?.length ?? 0) > 0 && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-lg text-navy">Recent lessons</h3>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
              Total XP: {totalXp}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-cream">
            {(lessons as LessonRow[]).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {humanizeType(l.type)}
                    {l.status === "active" && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                        in progress
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                    {l.completed_at
                      ? `Completed ${new Date(l.completed_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}`
                      : `Started ${new Date(l.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {l.score_after != null && (
                    <span className="font-mono text-xs text-mute">
                      {l.score_after}/100
                    </span>
                  )}
                  {l.xp_awarded != null && l.xp_awarded > 0 && (
                    <span className="rounded-full border border-teal/30 bg-teal/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-teal">
                      +{l.xp_awarded} XP
                    </span>
                  )}
                  <Link
                    href={`/lessons/${l.id}`}
                    className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function humanizeType(t: string): string {
  return t
    .split("_")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

function LessonTypeCard({
  kicker,
  heading,
  body,
  activeId,
  startType,
}: {
  kicker: string;
  heading: string;
  body: string;
  activeId?: string;
  startType: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg border border-cream bg-paper p-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          {kicker}
        </p>
        <h2 className="mt-1 font-serif text-xl text-navy">{heading}</h2>
        <p className="mt-2 text-sm text-mute">{body}</p>
      </div>
      {activeId ? (
        <Link
          href={`/lessons/${activeId}`}
          className="inline-block self-start rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-navy hover:bg-gold/20"
        >
          Resume in progress →
        </Link>
      ) : (
        <StartLessonButton type={startType} />
      )}
    </div>
  );
}
