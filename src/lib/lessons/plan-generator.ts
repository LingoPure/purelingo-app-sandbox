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
 * looped over here; see ISS-048 / rubric.ts).
 *
 * Three-tier modality ladder, not a flat skill→kind map (locked 2026-10):
 * live tutors introduce new material and give personalised coaching;
 * AI-voice drills/reinforces something already introduced; self-paced
 * lessons are everything else. So the four VOICE-NATIVE skills default to
 * `ai_voice` and only escalate to a live `class` once the gap is wide
 * enough that drilling alone won't close it — the same escalation
 * philosophy CLASS_RECOMMEND_GAP already applies to micro-lesson skills,
 * just one rung earlier on the ladder for skills where that rung exists:
 *
 *   speaking         → ai_voice, escalates to class past AI_VOICE_TO_CLASS_GAP
 *   listening        → ai_voice, escalates to class past AI_VOICE_TO_CLASS_GAP
 *   writing          → email_sprint (not voice-native — no ai_voice tier)
 *   reading          → email_sprint (not voice-native — no ai_voice tier)
 *   grammar          → ai_voice, escalates to class past AI_VOICE_TO_CLASS_GAP
 *   live_interaction → ai_voice, escalates to class past AI_VOICE_TO_CLASS_GAP
 *
 * For a written (micro_lesson) skill with gap > CLASS_RECOMMEND_GAP, ALSO
 * recommend a teacher-led class on top — unchanged from before.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILL_KEYS, SKILL_LABELS, type SkillKey } from "@/lib/scoring/rubric";
import { loadBaselinesForStudent } from "@/lib/scoring/baselines";

export type RecommendationKind = "micro_lesson" | "ai_voice" | "class";
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
 * For each skill the student is below baseline on, what we recommend as
 * the DEFAULT (lowest) rung of its modality ladder. Multiple micro_lesson
 * skills can map to the same lesson type — the consolidation step below
 * collapses those duplicates so we don't recommend "email_sprint" three
 * times in a row. ai_voice/class recommendations stay per-skill.
 */
const SKILL_TO_RECOMMENDATION: Record<
  SkillKey,
  | { kind: "micro_lesson"; lessonType: MicroLessonType; title: string }
  | { kind: "ai_voice"; title: string }
  | { kind: "class"; title: string }
> = {
  speaking: {
    kind: "ai_voice",
    title: "AI voice practice — drill fluency and delivery",
  },
  listening: {
    kind: "ai_voice",
    title: "AI voice practice — listening comprehension drills",
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
    kind: "ai_voice",
    title: "AI voice practice — grammar accuracy reps",
  },
  live_interaction: {
    kind: "ai_voice",
    title: "AI voice practice — real-time conversation reps",
  },
};

const CRITICAL_GAP_THRESHOLD = 100;
const CLASS_RECOMMEND_GAP = 200;
/** Same value/philosophy as CLASS_RECOMMEND_GAP, applied one rung earlier
 *  on the ladder: past this gap, reinforcement alone won't close it — the
 *  skill needs new material or personalised coaching, i.e. a live tutor. */
const AI_VOICE_TO_CLASS_GAP = 200;

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
          : map.kind === "ai_voice"
            ? buildAiVoice(skill, score, baseline, baseline, map.title, "optional",
                "No score yet — try a quick practice session to seed your profile.")
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
    } else if (map.kind === "ai_voice") {
      recs.push(
        buildAiVoice(
          skill,
          score,
          baseline,
          gap,
          map.title,
          priority,
          `Gap of ${gap} below the ${baseline} role baseline. Short, repeated AI voice drills are the fastest way to close a gap this size — available any time, not just on a schedule.`
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
          `Gap of ${gap} below baseline — wide enough that this needs a live tutor's personalised coaching, not just drilling.`
        )
      );
    }

    // Big-gap escalation: recommend a teacher-led class on TOP of the
    // lower rung when the gap is too wide for that rung alone to close —
    // written skills escalate from micro_lesson, voice-native skills
    // escalate from ai_voice. Same philosophy, two different gap
    // constants (currently equal in value, kept separate so they can be
    // tuned independently once real completion data exists).
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
    if (gap >= AI_VOICE_TO_CLASS_GAP && map.kind === "ai_voice") {
      recs.push(
        buildClass(
          skill,
          score,
          baseline,
          gap,
          `Live class — focused ${SKILL_LABELS[skill].toLowerCase()} coaching`,
          "recommended",
          `Gap of ${gap} is wide enough that drilling alone won't close it — this needs a live tutor to introduce new approaches, not just reinforce existing ones.`
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

function buildAiVoice(
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
    kind: "ai_voice",
    title,
    rationale,
    // source=plan marks this as curriculum-recommended, not the student's
    // own on-demand initiative — see /practice and usage-cap.ts: a
    // recommended session doesn't count against the daily on-demand cap,
    // since the curriculum engine already paces how many of these exist.
    ctaHref: `/practice?skill=${skill}&source=plan`,
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
