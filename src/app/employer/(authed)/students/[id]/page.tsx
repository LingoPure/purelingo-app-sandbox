import Link from "next/link";
import { notFound } from "next/navigation";
import { GapRadar } from "@/components/dashboard/gap-radar";
import { loadStudentDetail } from "@/lib/employer/data";
import { SKILL_KEYS } from "@/lib/scoring/rubric";

const SKILL_LABEL: Record<string, string> = {
  speaking_fluency: "Speaking",
  listening_comprehension: "Listening",
  writing_formal: "Writing",
  reading_intent: "Reading intent",
  business_vocabulary: "Vocabulary",
  presentation_delivery: "Presenting",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadStudentDetail(id);
  if (!detail) notFound();

  const { student, profile, recentLessons, recentClasses, certifications } =
    detail;

  const radarSkills = SKILL_KEYS.map((k) => ({
    key: k,
    label: SKILL_LABEL[k] ?? k,
    score: student.scores[k],
    target: 800,
  }));

  const hasAnyScore = radarSkills.some((s) => s.score != null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/employer/students"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy"
        >
          ← Roster
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold">
              Student profile
            </p>
            <h1 className="font-serif text-3xl text-navy">
              {student.name?.trim() || student.email || "Unnamed student"}
            </h1>
            {student.email && (
              <p className="mt-1 font-mono text-xs text-mute">
                {student.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CefrBadge label="Target" band={student.target_level ?? "B2"} tone="target" />
            {profile?.overall_cefr && (
              <CefrBadge label="Now" band={profile.overall_cefr} tone="current" />
            )}
          </div>
        </div>
      </div>

      {profile?.summary && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Discovery summary
          </p>
          <p className="font-serif text-lg leading-relaxed text-navy">
            {profile.summary}
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        <div className="rounded-lg border border-cream bg-paper p-6">
          <h2 className="mb-4 font-serif text-xl text-navy">Gap profile</h2>
          {hasAnyScore ? (
            <div className="flex justify-center">
              <GapRadar skills={radarSkills} />
            </div>
          ) : (
            <p className="text-sm text-mute">
              No scores yet — student hasn&apos;t completed discovery.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {profile?.target_why && (
            <ProfileBlock heading="Why this target" body={profile.target_why} />
          )}
          {profile?.learning_style_notes && (
            <ProfileBlock
              heading="Learning style"
              body={profile.learning_style_notes}
            />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Total XP" value={student.totalXp} />
        <StatTile label="Lessons completed" value={student.lessonsCompleted} />
        <StatTile label="Classes attended" value={student.classesCompleted} />
      </section>

      {certifications.length > 0 && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <h3 className="mb-3 font-serif text-lg text-navy">Certifications</h3>
          <ul className="flex flex-col divide-y divide-cream">
            {certifications.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      c.status === "passed"
                        ? "rounded-full border border-teal/30 bg-teal/5 px-3 py-0.5 font-serif text-base text-teal"
                        : c.status === "failed"
                        ? "rounded-full border border-coral/30 bg-coral/5 px-3 py-0.5 font-serif text-base text-coral"
                        : "rounded-full border border-gold/30 bg-gold/5 px-3 py-0.5 font-serif text-base text-gold"
                    }
                  >
                    {c.level}
                  </span>
                  <div>
                    <p className="text-sm capitalize text-ink">{c.status}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                      {c.issued_at
                        ? `Issued ${new Date(c.issued_at).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })}`
                        : `Created ${new Date(c.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ListCard
          heading="Recent lessons"
          empty="No lessons yet."
          items={recentLessons.map((l) => ({
            primary:
              l.type === "speak_score" ? "Speak & score" : "Email sprint",
            secondary: l.completed_at
              ? new Date(l.completed_at).toLocaleDateString("en-AU", {
                  month: "short",
                  day: "numeric",
                })
              : "in progress",
            trailing:
              l.score_after !== null
                ? `${l.score_after}/100 · +${l.xp_awarded ?? 0} XP`
                : "—",
          }))}
        />
        <ListCard
          heading="Recent classes"
          empty="No classes yet."
          items={recentClasses.map((c) => ({
            primary: c.teacher_name ?? "Coach",
            secondary: c.scheduled_at
              ? new Date(c.scheduled_at).toLocaleDateString("en-AU", {
                  month: "short",
                  day: "numeric",
                })
              : "—",
            trailing: c.transcribed_at ? "Scored" : "—",
          }))}
        />
      </section>
    </div>
  );
}

function ProfileBlock({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
        {heading}
      </p>
      <p className="text-sm leading-relaxed text-ink">{body}</p>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl text-navy">{value}</p>
    </div>
  );
}

function ListCard({
  heading,
  items,
  empty,
}: {
  heading: string;
  items: { primary: string; secondary: string; trailing: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <h3 className="mb-3 font-serif text-lg text-navy">{heading}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-mute">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-cream">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{it.primary}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                  {it.secondary}
                </p>
              </div>
              <span className="font-mono text-xs text-mute">{it.trailing}</span>
            </li>
          ))}
        </ul>
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
  band: string;
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
