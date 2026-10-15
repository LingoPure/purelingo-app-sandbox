/**
 * Nudge rules — pure functions over a "snapshot" of the cohort.
 *
 * Each rule inspects the snapshot and emits NudgeCandidate rows that
 * the cron handler then de-dupes against today's existing nudges and
 * inserts. Keep rules cheap (no I/O); the cron loads everything once.
 */

export type CohortSnapshot = {
  /** UTC date "YYYY-MM-DD" — supplied by caller so tests can pin time. */
  today: string;
  students: SnapshotStudent[];
};

export type ProgrammeSkillTarget = {
  skill: string;
  label: string;
  kind: "micro_lesson" | "ai_voice" | "class";
  timesPerWeek: number;
  ctaHref: string;
};

export type ProgrammeSnapshotInfo = {
  committedAt: string; // ISO
  totalWeeks: number;
  /** Union of every phase's skill_targets — cadence targets apply across
   *  the whole programme, not per phase (see programme-snapshot.ts). */
  skillTargets: ProgrammeSkillTarget[];
  kickoffNudgeSentAt: string | null;
  lastCadenceNudgeWeek: number | null;
};

export type SnapshotStudent = {
  id: string;
  email: string | null;
  name: string | null;
  target_level: string | null;
  discovery_status: string | null;
  averageScore: number | null;
  streak_days: number | null;
  last_active_date: string | null; // "YYYY-MM-DD"
  nextClassAt: string | null; // ISO timestamp
  /** null until the student has an active programme_snapshots row. */
  programme: ProgrammeSnapshotInfo | null;
  /** Completions in the personal programme-week that JUST ended (not the
   *  current partial week), keyed by `targetKey()` — (kind, skill), NOT
   *  skill alone. A skill can carry both an `ai_voice` target (drill with
   *  Aria) and a `class` target (live tutor) at once — Shamini's actual
   *  live_interaction gap does exactly this — and the two are tracked in
   *  completely different tables (ai_voice_tutor_sessions vs
   *  classin_sessions). Keying by skill alone would let a voice drill
   *  silently satisfy a class target that was never attended. Null unless
   *  a week boundary for THIS student's own committedAt falls on `today`
   *  — see the cron's data-loading step, which only computes this when
   *  relevant. */
  lastCompletedWeekByTarget: Record<string, number> | null;
};

/** The one key format for matching activity to a target — (kind, skill),
 *  not skill alone (see lastCompletedWeekByTarget's doc comment). */
export function targetKey(t: { kind: string; skill: string }): string {
  return `${t.kind}:${t.skill}`;
}

export type NudgeCandidate = {
  studentId: string;
  rule: string;
  channel: "email";
  type: string;
  subject: string;
  body: string;
  /** Deep-link for the email's CTA button. Omit to fall back to /dashboard
   *  (every existing rule's current behaviour, unchanged). */
  ctaHref?: string;
  ctaLabel?: string;
};

export type NudgeRule = (snapshot: CohortSnapshot) => NudgeCandidate[];

/**
 * `streak_at_risk`: student is mid-streak, last active YESTERDAY (UTC).
 * Hit them today before midnight rolls and the streak breaks.
 */
export const streakAtRisk: NudgeRule = ({ today, students }) => {
  const yesterday = isoDateAddDays(today, -1);
  return students
    .filter(
      (s) =>
        s.email &&
        (s.streak_days ?? 0) >= 2 &&
        s.last_active_date === yesterday
    )
    .map((s) => ({
      studentId: s.id,
      rule: "streak_at_risk",
      channel: "email" as const,
      type: "engagement",
      subject: `Don't break your ${s.streak_days}-day streak${
        s.name ? `, ${firstName(s.name)}` : ""
      }`,
      body: `One five-minute lesson keeps the fire burning. Open LingoPure → Lessons.`,
    }));
};

/**
 * `streak_broken`: student had a meaningful streak (≥3) and went silent
 * for 2+ days. Welcome them back.
 */
export const streakBroken: NudgeRule = ({ today, students }) => {
  return students
    .filter((s) => s.email && (s.streak_days ?? 0) === 0 && s.last_active_date)
    .filter((s) => {
      // Restrict to "recently broke a 3+ streak" by checking the gap is
      // exactly 2 days (yesterday's run would have caught a 1-day gap as
      // streak_at_risk for everyone, so this is the recovery follow-up).
      const gap = daysBetween(s.last_active_date!, today);
      return gap === 2;
    })
    .map((s) => ({
      studentId: s.id,
      rule: "streak_broken",
      channel: "email" as const,
      type: "engagement",
      subject: `Welcome back${s.name ? `, ${firstName(s.name)}` : ""}`,
      body: `Two days off is fine — start a fresh streak today. The first lesson is the hardest.`,
    }));
};

/**
 * `inactivity_5d`: any student who hasn't been active in 5+ days. Generic
 * re-engagement.
 */
export const inactivity5d: NudgeRule = ({ today, students }) => {
  return students
    .filter((s) => s.email && s.last_active_date)
    .filter((s) => daysBetween(s.last_active_date!, today) >= 5)
    .map((s) => ({
      studentId: s.id,
      rule: "inactivity_5d",
      channel: "email" as const,
      type: "engagement",
      subject: `Aria misses you${s.name ? `, ${firstName(s.name)}` : ""}`,
      body: `It's been five days. A short session today resets your gap profile and gets you back on track. Five minutes is enough.`,
    }));
};

/**
 * `cert_pushable`: average score within 5 points of 80 (B2 floor) AND the
 * student doesn't already have a passed B2 cert. Strong signal to schedule.
 */
export const certPushable: NudgeRule = ({ students }) => {
  return students
    .filter(
      (s) =>
        s.email &&
        s.averageScore !== null &&
        s.averageScore >= 75 &&
        s.averageScore < 80
    )
    .map((s) => ({
      studentId: s.id,
      rule: "cert_pushable",
      channel: "email" as const,
      type: "milestone",
      subject: `You're ${80 - (s.averageScore ?? 0)} points from B2 certification`,
      body: `Your gap profile shows you're within striking distance of the B2 threshold. One focused week and you can schedule the TrackTest exam. Reply if you want a custom plan.`,
    }));
};

/**
 * `class_tomorrow`: a ClassIn session is scheduled within the next 24h.
 * Polite reminder.
 */
export const classTomorrow: NudgeRule = ({ today, students }) => {
  const cutoffStart = new Date(`${today}T00:00:00Z`).getTime();
  const cutoffEnd = cutoffStart + 48 * 60 * 60 * 1000;
  return students
    .filter((s) => s.email && s.nextClassAt)
    .filter((s) => {
      const t = new Date(s.nextClassAt!).getTime();
      return t >= cutoffStart && t < cutoffEnd;
    })
    .map((s) => {
      const when = new Date(s.nextClassAt!).toLocaleString("en-AU", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
      });
      return {
        studentId: s.id,
        rule: "class_tomorrow",
        channel: "email" as const,
        type: "class_reminder",
        subject: `Your class is ${when}`,
        body: `Quick reminder: your live class with your coach is coming up. Headphones, quiet spot, and you're set.`,
      };
    });
};

/**
 * `programme_kickoff`: fires exactly once, the first time a student has an
 * active programme snapshot and hasn't been kickoff-nudged yet. Points at
 * the first non-optional skill target's own CTA, not a generic /dashboard
 * link — "here's your real first action," not "go explore."
 */
export const programmeKickoff: NudgeRule = ({ students }) => {
  return students
    .filter((s) => s.email && s.programme && !s.programme.kickoffNudgeSentAt)
    .map((s) => {
      const first = s.programme!.skillTargets[0];
      return {
        studentId: s.id,
        rule: "programme_kickoff",
        channel: "email" as const,
        type: "kickoff",
        subject: `Your programme starts now${s.name ? `, ${firstName(s.name)}` : ""}`,
        body: first
          ? `Your gap-driven programme is ready. First up: ${first.label} — aim for ${first.timesPerWeek}× this week.`
          : `Your gap-driven programme is ready — open your dashboard to see what's first.`,
        ctaHref: first?.ctaHref,
        ctaLabel: first ? "Start now →" : undefined,
      };
    });
};

/**
 * Which personal programme-week just closed, if any — pure function of
 * `committedAt` and `today`, shared by `programmeCadenceBehind` (decides
 * whether to fire) and the nudge cron (decides which date range to query
 * micro_lessons/classin_sessions for, and what to write back after a
 * send). One formula, not two copies that could drift apart.
 *
 * A full personal week just closed when `today` is exactly day 7, 14,
 * 21, ... after `committedAt`'s date. Returns null on any other day.
 */
export function weekJustEndedFor(committedAt: string, today: string): number | null {
  const startDate = committedAt.slice(0, 10);
  const daysSinceStart = daysBetween(startDate, today);
  if (daysSinceStart <= 0 || daysSinceStart % 7 !== 0) return null;
  return daysSinceStart / 7;
}

/**
 * `programme_cadence_behind`: fires once per student per personal
 * programme-week that just ended, when at least one non-class skill target
 * was under-met. Class-kind shortfalls get "check your schedule" copy,
 * never "you're behind" — the student doesn't control teacher assignment
 * for auto-scheduled classes (classin/scheduling.ts).
 */
export const programmeCadenceBehind: NudgeRule = ({ today, students }) => {
  return students
    .filter((s) => s.email && s.programme && s.lastCompletedWeekByTarget != null)
    .flatMap((s) => {
      const programme = s.programme!;
      const weekJustEnded = weekJustEndedFor(programme.committedAt, today);
      if (weekJustEnded == null) return [];
      if (weekJustEnded > programme.totalWeeks) return []; // programme has run its course
      if (
        programme.lastCadenceNudgeWeek != null &&
        weekJustEnded <= programme.lastCadenceNudgeWeek
      ) {
        return []; // already evaluated/nudged for this week
      }

      const shortfalls = programme.skillTargets.filter(
        (t) => (s.lastCompletedWeekByTarget![targetKey(t)] ?? 0) < t.timesPerWeek
      );
      if (shortfalls.length === 0) return [];

      const classShortfalls = shortfalls.filter((t) => t.kind === "class");
      const otherShortfalls = shortfalls.filter((t) => t.kind !== "class");

      const parts: string[] = [];
      if (otherShortfalls.length > 0) {
        const names = otherShortfalls.map((t) => t.label).join(", ");
        parts.push(`Last week's target for ${names} wasn't quite met.`);
      }
      if (classShortfalls.length > 0) {
        parts.push(`Check your schedule with your coach for upcoming classes.`);
      }

      const cand: NudgeCandidate = {
        studentId: s.id,
        rule: "programme_cadence_behind",
        channel: "email" as const,
        type: "cadence",
        subject: `Keeping pace with your programme${s.name ? `, ${firstName(s.name)}` : ""}`,
        body: parts.join(" "),
        ctaHref: otherShortfalls[0]?.ctaHref,
        ctaLabel: otherShortfalls[0] ? "Catch up →" : undefined,
      };
      return [cand];
    });
};

/** All rules in evaluation order. Earlier rules win on conflict. */
export const ALL_RULES: NudgeRule[] = [
  classTomorrow,
  programmeKickoff,
  streakAtRisk,
  streakBroken,
  certPushable,
  programmeCadenceBehind,
  inactivity5d,
];

export function evaluateAllRules(snapshot: CohortSnapshot): NudgeCandidate[] {
  // De-dupe per (student, rule). Each student gets at most ONE nudge per
  // run across all rules — pick the highest-priority one (rule order).
  const byStudent = new Map<string, NudgeCandidate>();
  for (const rule of ALL_RULES) {
    for (const candidate of rule(snapshot)) {
      if (!byStudent.has(candidate.studentId)) {
        byStudent.set(candidate.studentId, candidate);
      }
    }
  }
  return [...byStudent.values()];
}

function isoDateAddDays(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00Z`).getTime();
  const tb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

function firstName(full: string): string {
  return full.trim().split(/\s+/).slice(-1)[0] ?? full;
}
