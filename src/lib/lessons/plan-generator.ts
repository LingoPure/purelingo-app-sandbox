/**
 * Gap-driven lesson plan generator.
 *
 * Pure derivation: reads the student's CANONICAL gap_scores rows + role
 * baselines and returns a ranked list of recommendations — micro-lessons
 * for skills that have an existing generator (email_sprint / speak_score)
 * and ClassIn class recommendations for skills that don't yet, or for any
 * gap big enough to warrant teacher-led work.
 *
 * Stateless: no database writes. The dashboard calls this on every page
 * load (cheap — a few rows + arithmetic).
 *
 * Skill → recommendation mapping (six PRIMARY dimensions only — the two
 * supporting measures, business_vocabulary/presentation_delivery, are not
 * looped over here; see ISS-048 / rubric.ts):
 *
 *   speaking         → speak_score (Claude-evaluated 90-second monologue)
 *   listening        → ClassIn class (no micro-lesson generator yet)
 *   writing          → email_sprint
 *   reading          → email_sprint  (the rubric's reading dimension)
 *   grammar          → ClassIn class (no micro-lesson generator yet)
 *   live_interaction → ClassIn class (no micro-lesson generator yet)
 *
 * For any skill with gap > 200, ALSO recommend a teacher-led class
 * regardless of whether a micro-lesson exists — that's spec-aligned
 * "remediation needs human in the loop" logic.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILL_KEYS, SKILL_LABELS, type SkillKey } from "@/lib/scoring/rubric";
import { loadBaselinesForStudent } from "@/lib/scoring/baselines";

export type RecommendationKind = "micro_lesson" | "class";
export type Priority = "critical" | "recommended" | "optional";
export type MicroLessonType = "email_sprint" | "speak_score";

export type PlanRecommendation = {
  skill: SkillKey;
  skillLabel: string;
  /** baseline minus current canonical score; positive = below target. */
  gap: number;
  score: number | null;
  baseline: number;
  kind: RecommendationKind;
  /** Only set when kind = "micro_lesson". */
  lessonType?: MicroLessonType;
  title: string;
  rationale: string;
  /** Where the dashboard "Start" button takes the student. */
  ctaHref: string;
  /** Sort key for the UI; "critical" surfaces above "recommended". */
  priority: Priority;
};

/**
 * For each skill the student is below baseline on, what we recommend.
 * Multiple skills can map to the same lesson type — the consolidation
 * step below collapses duplicates so we don't recommend "email_sprint"
 * three times in a row.
 */
const SKILL_TO_RECOMMENDATION: Record<
  SkillKey,
  | { kind: "micro_lesson"; lessonType: MicroLessonType; title: string }
  | { kind: "class"; title: string }
> = {
  speaking: {
    kind: "micro_lesson",
    lessonType: "speak_score",
    title: "Speaking sprint — 90-second monologue",
  },
  listening: {
    kind: "class",
    title: "Live class — listening comprehension drills",
  },
  writing: {
    kind: "micro_lesson",
    lessonType: "email_sprint",
    title: "Email sprint — write a calibrated reply",
  },
  reading: {
    kind: "micro_lesson",
    lessonType: "email_sprint",
    title: "Email sprint — practise reading subtext",
  },
  grammar: {
    kind: "class",
    title: "Live class — grammar accuracy coaching",
  },
  live_interaction: {
    kind: "class",
    title: "Live class — real-time conversation drills",
  },
};

const CRITICAL_GAP_THRESHOLD = 100;
const CLASS_RECOMMEND_GAP = 200;

type CanonicalScoreRow = {
  skill: SkillKey;
  score: number | null;
  target: number | null;
  is_canonical: boolean;
};

export async function generateLessonPlan(
  supabase: SupabaseClient,
  studentId: string
): Promise<PlanRecommendation[]> {
  const [scoresRes, baselines] = await Promise.all([
    supabase
      .from("gap_scores")
      .select("skill, score, target, is_canonical")
      .eq("student_id", studentId)
      .eq("is_canonical", true),
    loadBaselinesForStudent(supabase, studentId),
  ]);

  const rows = (scoresRes.data ?? []) as CanonicalScoreRow[];
  const scoreBySkill = new Map<SkillKey, CanonicalScoreRow>();
  for (const r of rows) {
    if ((SKILL_KEYS as readonly string[]).includes(r.skill)) {
      scoreBySkill.set(r.skill, r);
    }
  }

  const recs: PlanRecommendation[] = [];

  for (const skill of SKILL_KEYS) {
    const row = scoreBySkill.get(skill);
    const score = row?.score ?? null;
    const baseline = row?.target ?? baselines[skill];
    const gap = score == null ? baseline : Math.max(0, baseline - score);

    // No score yet (e.g. battery hasn't finished) — surface a soft probe
    // suggestion so the dashboard doesn't look empty for new users, but
    // mark it optional so it doesn't push critical work down.
    if (score == null) {
      const map = SKILL_TO_RECOMMENDATION[skill];
      recs.push(
        map.kind === "micro_lesson"
          ? buildMicroLesson(skill, score, baseline, baseline, map, "optional",
              "No score yet — try a quick lesson to seed your profile.")
          : buildClass(skill, score, baseline, baseline, map.title, "optional",
              "No score yet — book a class to start gathering signal.")
      );
      continue;
    }
    if (gap <= 0) continue; // already at or above baseline — no rec needed.

    const priority: Priority =
      gap >= CRITICAL_GAP_THRESHOLD ? "critical" : "recommended";

    const map = SKILL_TO_RECOMMENDATION[skill];
    if (map.kind === "micro_lesson") {
      recs.push(
        buildMicroLesson(
          skill,
          score,
          baseline,
          gap,
          map,
          priority,
          `Gap of ${gap} below the ${baseline} role baseline. ${
            priority === "critical"
              ? "This is the biggest single deficit on your profile — start here."
              : "Closing this gap moves you toward the role baseline."
          }`
        )
      );
    } else {
      recs.push(
        buildClass(
          skill,
          score,
          baseline,
          gap,
          map.title,
          priority,
          `Gap of ${gap} below baseline. Listening is best worked on with a teacher who can vary accent and pace.`
        )
      );
    }

    // Big-gap escalation: recommend a teacher-led class on TOP of the
    // micro-lesson when the gap is too wide for self-serve practice
    // alone to close.
    if (gap >= CLASS_RECOMMEND_GAP && map.kind === "micro_lesson") {
      recs.push(
        buildClass(
          skill,
          score,
          baseline,
          gap,
          `Live class — focused ${SKILL_LABELS[skill].toLowerCase()} coaching`,
          "recommended",
          `Gap of ${gap} is wide enough that a one-on-one class will accelerate the micro-lessons.`
        )
      );
    }
  }

  // Consolidate: collapse duplicate (kind, lessonType) recommendations
  // into a single combined entry so the UI doesn't show "email_sprint"
  // three times. Keep the highest-gap skill as the headline; merge the
  // others into the rationale.
  const consolidated = consolidate(recs);

  // Sort: critical → recommended → optional, then by gap descending.
  const priorityRank: Record<Priority, number> = {
    critical: 0,
    recommended: 1,
    optional: 2,
  };
  consolidated.sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return b.gap - a.gap;
  });

  return consolidated;
}

function buildMicroLesson(
  skill: SkillKey,
  score: number | null,
  baseline: number,
  gap: number,
  map: { kind: "micro_lesson"; lessonType: MicroLessonType; title: string },
  priority: Priority,
  rationale: string
): PlanRecommendation {
  return {
    skill,
    skillLabel: SKILL_LABELS[skill],
    gap,
    score,
    baseline,
    kind: "micro_lesson",
    lessonType: map.lessonType,
    title: map.title,
    rationale,
    ctaHref: `/lessons?start=${map.lessonType}&focus=${skill}`,
    priority,
  };
}

function buildClass(
  skill: SkillKey,
  score: number | null,
  baseline: number,
  gap: number,
  title: string,
  priority: Priority,
  rationale: string
): PlanRecommendation {
  return {
    skill,
    skillLabel: SKILL_LABELS[skill],
    gap,
    score,
    baseline,
    kind: "class",
    title,
    rationale,
    ctaHref: `/dashboard#schedule-class`,
    priority,
  };
}

function consolidate(recs: PlanRecommendation[]): PlanRecommendation[] {
  // Collapse duplicates by (kind, lessonType) for micro-lessons. Classes
  // stay separate because they're per-skill teacher recommendations.
  const seenLessonTypes = new Map<string, PlanRecommendation>();
  const passThrough: PlanRecommendation[] = [];

  for (const r of recs) {
    if (r.kind === "micro_lesson" && r.lessonType) {
      const key = r.lessonType;
      const prior = seenLessonTypes.get(key);
      if (!prior) {
        seenLessonTypes.set(key, r);
      } else if (r.gap > prior.gap) {
        // The wider-gap skill becomes the headline; merge the prior into
        // rationale so the smaller-gap skill isn't lost.
        const merged: PlanRecommendation = {
          ...r,
          rationale:
            r.rationale +
            ` Also covers ${prior.skillLabel.toLowerCase()} (gap ${prior.gap}).`,
        };
        seenLessonTypes.set(key, merged);
      } else {
        seenLessonTypes.set(key, {
          ...prior,
          rationale:
            prior.rationale +
            ` Also covers ${r.skillLabel.toLowerCase()} (gap ${r.gap}).`,
        });
      }
    } else {
      passThrough.push(r);
    }
  }
  return [...seenLessonTypes.values(), ...passThrough];
}
