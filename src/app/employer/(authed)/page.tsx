import Link from "next/link";
import { GapRadar } from "@/components/dashboard/gap-radar";
import { SeedButton } from "./seed-button";

export const dynamic = "force-dynamic";
import {
  loadCohortStudents,
  summariseCohort,
  loadActivityFeed,
  loadCoverageByRole,
  type RoleCoverage,
} from "@/lib/employer/data";
import { SKILL_KEYS } from "@/lib/scoring/rubric";

const SKILL_LABEL: Record<string, string> = {
  speaking_fluency: "Speaking",
  listening_comprehension: "Listening",
  writing_formal: "Writing",
  reading_intent: "Reading intent",
  business_vocabulary: "Vocabulary",
  presentation_delivery: "Presenting",
};

export default async function EmployerOverviewPage() {
  const [students, activity, roleCoverage] = await Promise.all([
    loadCohortStudents(),
    loadActivityFeed(10),
    loadCoverageByRole(),
  ]);
  const summary = summariseCohort(students);

  const radarSkills = SKILL_KEYS.map((k) => ({
    key: k,
    label: SKILL_LABEL[k] ?? k,
    score: summary.averageBySkill[k],
    target: 80,
  }));

  const topStudents = [...students]
    .sort((a, b) => (b.totalXp + b.lessonsCompleted * 5) - (a.totalXp + a.lessonsCompleted * 5))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Pilot cohort
          </p>
          <h1 className="font-serif text-3xl text-navy">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Aggregate progress across the cohort. Numbers update in real time as
            students complete discovery, attend live classes, and finish micro-lessons.
          </p>
        </div>
        {summary.studentCount < 5 && <SeedButton />}
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricTile label="Active students" value={summary.studentCount} />
        <MetricTile
          label="Lessons completed"
          value={summary.totalLessonsCompleted}
        />
        <MetricTile
          label="Live classes"
          value={summary.totalClassesCompleted}
        />
        <MetricTile
          label="Certified"
          value={summary.certifiedCount}
          accent
        />
        <MetricTile
          label="At target (≥80)"
          value={`${summary.pctAtTarget}%`}
          accent
        />
      </section>

      {roleCoverage.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
                Coverage by role
              </p>
              <h2 className="font-serif text-xl text-navy">
                How the cohort tracks against each role&apos;s baseline
              </h2>
            </div>
            <Link
              href="/employer/roles"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
            >
              Manage roles →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roleCoverage.map((r) => (
              <RoleCoverageCard key={r.roleId} role={r} />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Cohort gap profile
          </p>
          <h2 className="mb-4 font-serif text-xl text-navy">
            Average across all students
          </h2>
          <div className="flex justify-center">
            <GapRadar skills={radarSkills} />
          </div>
        </div>

        <div className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl text-navy">Most active</h2>
            <Link
              href="/employer/students"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
            >
              View all →
            </Link>
          </div>
          {topStudents.length === 0 ? (
            <p className="text-sm text-mute">
              No students yet — invite a few via signup. They&apos;ll show up
              here automatically.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-cream">
              {topStudents.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {s.name?.trim() || s.email || "Unnamed student"}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                      {s.lessonsCompleted} lesson
                      {s.lessonsCompleted === 1 ? "" : "s"} ·{" "}
                      {s.classesCompleted} class
                      {s.classesCompleted === 1 ? "" : "es"} ·{" "}
                      {s.totalXp} XP
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.averageScore !== null && (
                      <span className="font-mono text-xs text-mute">
                        avg {s.averageScore}/100
                      </span>
                    )}
                    <Link
                      href={`/employer/students/${s.id}`}
                      className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <h2 className="mb-4 font-serif text-xl text-navy">Activity feed</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-mute">
            Nothing yet. As students complete sessions, lessons, and classes,
            activity appears here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-cream">
            {activity.map((e, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    <Link
                      href={`/employer/students/${e.studentId}`}
                      className="font-medium text-navy hover:underline"
                    >
                      {e.studentName}
                    </Link>{" "}
                    {e.detail}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                    {kindLabel(e.kind)} ·{" "}
                    {new Date(e.occurredAt).toLocaleDateString("en-AU", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-lg border border-teal/30 bg-teal/5 p-5"
          : "rounded-lg border border-cream bg-paper p-5"
      }
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl text-navy">{value}</p>
    </div>
  );
}

function RoleCoverageCard({ role }: { role: RoleCoverage }) {
  const pct = role.pctMeetingAll;
  // Tone the headline number by how covered the cohort is.
  const pctTone =
    pct >= 80
      ? "text-teal"
      : pct >= 50
      ? "text-navy"
      : "text-gold";

  const worstLabel = role.worstSkill ? SKILL_LABEL[role.worstSkill] : null;

  return (
    <Link
      href={`/employer/roles/${role.roleId}`}
      className="group flex flex-col gap-3 rounded-lg border border-cream bg-paper p-5 transition hover:border-navy/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg text-navy">
            {role.roleName}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            {role.studentCount} student
            {role.studentCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-serif text-2xl ${pctTone}`}>{pct}%</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-mute">
            meeting bar
          </p>
        </div>
      </div>

      {role.studentCount === 0 ? (
        <p className="text-xs text-mute">
          No students assigned to this role yet.
        </p>
      ) : worstLabel && role.worstSkillGap !== null && role.worstSkillGap > 0 ? (
        <div className="rounded-md bg-cream/50 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
            Biggest gap
          </p>
          <p className="text-sm text-ink">
            {worstLabel} —{" "}
            <span className="font-medium text-navy">
              {role.worstSkillGap} pts
            </span>{" "}
            below baseline
          </p>
        </div>
      ) : (
        <div className="rounded-md bg-teal/5 px-3 py-2">
          <p className="text-sm text-teal">All skills at or above baseline.</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-navy opacity-0 transition group-hover:opacity-100">
        Open role →
      </p>
    </Link>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "discovery":
      return "Discovery";
    case "class":
      return "Live class";
    case "lesson_email":
      return "Email sprint";
    case "lesson_speak":
      return "Speak & score";
    default:
      return kind;
  }
}
