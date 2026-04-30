/**
 * TrackTest exam eligibility — turns a gap profile into a recommended
 * exam level.
 *
 * Briefing §05.10 calls for "exam readiness predicted from gap score".
 * We use a pragmatic threshold: every sub-skill must clear the floor
 * for that band before we'll surface the exam in the dashboard. A
 * single weak sub-skill blocks readiness for the level above.
 *
 * Thresholds map to the same 0–100 → CEFR scale used elsewhere:
 *   B1 floor = 40
 *   B2 floor = 60
 *   C1 floor = 80
 *
 * Returned recommendation is the highest band the student clears in
 * EVERY sub-skill, plus a list of any sub-skills holding them back
 * from the band above.
 */

import type { SkillKey } from "@/lib/scoring/rubric";

export type ExamLevel = "B1" | "B2" | "C1";

const FLOORS: Record<ExamLevel, number> = {
  B1: 40,
  B2: 60,
  C1: 80,
};

export type Eligibility = {
  /** Highest level the student is ready to sit. null if not yet at B1. */
  ready: ExamLevel | null;
  /** Suggested next level — what they should aim for. */
  nextLevel: ExamLevel;
  /** Sub-skills below the next-level floor (empty if ready for nextLevel). */
  blockingSkills: { skill: SkillKey; score: number; floor: number }[];
};

export function computeEligibility(
  scores: Record<SkillKey, number | null>
): Eligibility {
  const present = Object.entries(scores).filter(
    ([, v]) => typeof v === "number"
  ) as [SkillKey, number][];

  // No scores yet — recommend B1 by default, can't sit anything.
  if (present.length === 0) {
    return { ready: null, nextLevel: "B1", blockingSkills: [] };
  }

  let ready: ExamLevel | null = null;
  for (const level of ["B1", "B2", "C1"] as ExamLevel[]) {
    if (present.every(([, score]) => score >= FLOORS[level])) {
      ready = level;
    }
  }

  // Next level above the one they've reached. C1-ready students stay at C1.
  const nextLevel: ExamLevel =
    ready === "C1" ? "C1" : ready === "B2" ? "C1" : ready === "B1" ? "B2" : "B1";

  const floor = FLOORS[nextLevel];
  const blockingSkills = present
    .filter(([, score]) => score < floor)
    .map(([skill, score]) => ({ skill, score, floor }));

  return { ready, nextLevel, blockingSkills };
}
