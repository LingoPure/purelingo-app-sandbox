import { evaluateAllRules } from "@/lib/nudges/rules";

const candidates = evaluateAllRules({
  today: "2026-05-01",
  students: [
    {
      id: "a",
      email: "a@x.com",
      name: "Streak Broken",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 78,
      streak_days: 0,
      last_active_date: "2026-04-29",
      nextClassAt: null,
      programme: null,
      lastCompletedWeekByTarget: null,
    },
    {
      id: "b",
      email: "b@x.com",
      name: "Streaky",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 60,
      streak_days: 5,
      last_active_date: "2026-04-30",
      nextClassAt: null,
      programme: null,
      lastCompletedWeekByTarget: null,
    },
    {
      id: "c",
      email: "c@x.com",
      name: "Quiet One",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 50,
      streak_days: 0,
      last_active_date: "2026-04-25",
      nextClassAt: null,
      programme: null,
      lastCompletedWeekByTarget: null,
    },
    {
      id: "d",
      email: "d@x.com",
      name: "Almost There",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 77,
      streak_days: 2,
      last_active_date: "2026-05-01",
      nextClassAt: null,
      programme: null,
      lastCompletedWeekByTarget: null,
    },
    {
      id: "e",
      email: "e@x.com",
      name: "Class Soon",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 65,
      streak_days: 0,
      last_active_date: null,
      nextClassAt: "2026-05-02T18:00:00Z",
      programme: null,
      lastCompletedWeekByTarget: null,
    },
    {
      id: "f",
      email: null,
      name: "No Email",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 50,
      streak_days: 0,
      last_active_date: "2026-04-25",
      nextClassAt: null,
      programme: null,
      lastCompletedWeekByTarget: null,
    },
    {
      id: "g",
      email: "g@x.com",
      name: "Fresh Kickoff",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 60,
      streak_days: 0,
      last_active_date: null,
      nextClassAt: null,
      programme: {
        committedAt: "2026-05-01T00:00:00Z",
        totalWeeks: 8,
        skillTargets: [
          {
            skill: "live_interaction",
            label: "Live Interaction",
            kind: "ai_voice",
            timesPerWeek: 3,
            ctaHref: "/practice?skill=live_interaction&source=kickoff",
          },
        ],
        kickoffNudgeSentAt: null,
        lastCadenceNudgeWeek: null,
      },
      lastCompletedWeekByTarget: null,
    },
    {
      id: "h",
      email: "h@x.com",
      name: "Behind On Week One",
      target_level: "B2",
      discovery_status: "complete",
      averageScore: 60,
      streak_days: 0,
      last_active_date: null,
      nextClassAt: null,
      programme: {
        // committedAt is exactly 7 days before "today" (2026-05-01), so a
        // full week-1 just closed.
        committedAt: "2026-04-24T00:00:00Z",
        totalWeeks: 8,
        skillTargets: [
          {
            skill: "writing",
            label: "Writing",
            kind: "micro_lesson",
            timesPerWeek: 2,
            ctaHref: "/lessons?start=email_sprint&focus=writing&source=kickoff",
          },
        ],
        kickoffNudgeSentAt: "2026-04-24T01:00:00Z",
        lastCadenceNudgeWeek: null,
      },
      // Only did 1 of the 2 required email sprints last week.
      lastCompletedWeekByTarget: { "micro_lesson:writing": 1 },
    },
  ],
});

console.log("candidates:", candidates.length);
for (const c of candidates) {
  console.log(
    `  ${c.studentId.padEnd(2)} ${c.rule.padEnd(24)} → ${c.subject}${c.ctaHref ? ` (${c.ctaHref})` : ""}`
  );
}
