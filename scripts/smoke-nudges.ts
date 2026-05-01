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
    },
  ],
});

console.log("candidates:", candidates.length);
for (const c of candidates) {
  console.log(`  ${c.studentId.padEnd(2)} ${c.rule.padEnd(18)} → ${c.subject}`);
}
