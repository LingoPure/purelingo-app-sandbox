/**
 * Plan delivery — the "sit down with the client" conversation.
 *
 * After the battery of tests (discovery + email sprint + speak & score),
 * the student has a baseline. This module compiles that baseline into a
 * structured improvement programme and a system prompt for the voice agent
 * that delivers it — the AI equivalent of a human consultant walking a
 * client through their profile and getting commitment.
 *
 * Two outputs:
 *   1. Structured plan data (for the on-screen summary)
 *   2. Compiled system prompt (for the ElevenLabs voice agent)
 *
 * The plan is deterministic (no LLM call) — it's pure data compilation.
 * The voice agent adds warmth, explanation, and commitment capture on top.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SKILL_KEYS,
  SUPPORTING_SKILL_KEYS,
  SKILL_LABELS,
  type AnySkillKey,
  type CefrBand,
  type Lp18Band,
  scoreToLp18,
  scoreToCefrBand,
  computeGap,
} from "@/lib/scoring/rubric";
import {
  generateLessonPlan,
  type PlanRecommendation,
  type MicroLessonType,
} from "@/lib/lessons/plan-generator";

export type SkillProfile = {
  skill: AnySkillKey;
  label: string;
  score: number | null;
  baseline: number;
  /** Gap vs the role-floor value (baseline) — "good enough for the job". Null when unassessed. */
  roleFloorGap: number | null;
  /** Gap vs the CEFR aspiration target — "the goal". Null when unassessed. */
  targetGap: number | null;
  /** false when score is null — render "not yet assessed", never a 0 gap. */
  assessed: boolean;
  cefrBand: string;
  lp18Band: Lp18Band | null;
  evidence: string;
};

export type PlanPhase = {
  name: string;
  weeks: string;
  activities: { type: string; frequency: string; skill: string }[];
  rationale: string;
};

export type PlanData = {
  studentName: string;
  firstName: string;
  role: string;
  employer: string;
  currentLevel: string;
  /** LP-18 micro-band for currentLevel, e.g. "B2.3" — null if no skill is assessed yet. */
  currentLp18: Lp18Band | null;
  targetLevel: string;
  skills: SkillProfile[];
  /** Supporting/secondary measures — business_vocabulary, presentation_delivery. */
  supportingSkills: SkillProfile[];
  recommendations: PlanRecommendation[];
  phases: PlanPhase[];
  totalWeeks: number;
  nextStepStatement: string;
};

/**
 * Build the full plan data from a student's scores + role context.
 */
export async function buildPlan(
  supabase: SupabaseClient,
  studentId: string
): Promise<PlanData> {
  // 1. Load student + role context
  const { data: student } = await supabase
    .from("students")
    .select("name, target_level, role_id, employer_id")
    .eq("id", studentId)
    .single();

  const studentName = student?.name ?? "there";
  const firstName = studentName.split(" ")[0];
  const targetLevel = (student?.target_level as CefrBand | undefined) ?? "B2";

  // Not "your role" — every consumer interpolates this as "role as X" /
  // "Role: X" (plan/page.tsx, compilePlanPrompt), so a default containing
  // the word "role" produces the doubled "role as your role" Dan flagged.
  let roleName = "General Business";
  let employerName = "your company";
  if (student?.role_id) {
    const { data: role } = await supabase
      .from("roles")
      .select("name")
      .eq("id", student.role_id)
      .maybeSingle();
    roleName = role?.name ?? roleName;
  }
  if (student?.employer_id) {
    const { data: emp } = await supabase
      .from("employers")
      .select("name")
      .eq("id", student.employer_id)
      .maybeSingle();
    employerName = emp?.name ?? employerName;
  }

  // 2. Load canonical gap scores
  const { data: scoreRows } = await supabase
    .from("gap_scores")
    .select("skill, score, target, is_canonical")
    .eq("student_id", studentId)
    .eq("is_canonical", true);

  const scoreMap = new Map<string, { score: number | null; target: number }>();
  for (const row of scoreRows ?? []) {
    scoreMap.set(row.skill, { score: row.score, target: row.target });
  }

  // 3. Build skill profiles — six primary dimensions (the headline bars) and,
  // separately, the two supporting/secondary measures (ISS-048).
  const buildProfile = (skill: AnySkillKey): SkillProfile => {
    const row = scoreMap.get(skill);
    const score = row?.score ?? null;
    const baseline = row?.target ?? 800;
    const { roleFloorGap, targetGap, assessed } = computeGap(score, baseline, targetLevel);
    return {
      skill,
      label: SKILL_LABELS[skill],
      score,
      baseline,
      roleFloorGap,
      targetGap,
      assessed,
      cefrBand: assessed ? scoreToCefrBand(score!) : "not yet assessed",
      lp18Band: assessed ? scoreToLp18(score!) : null,
      evidence: "",
    };
  };
  const skills: SkillProfile[] = SKILL_KEYS.map(buildProfile);
  const supportingSkills: SkillProfile[] = SUPPORTING_SKILL_KEYS.map(buildProfile);

  // 4. Compute current aggregate level — same scoreToCefrBand/scoreToLp18 the
  // Dashboard uses, over the same live gap_scores, so the two surfaces agree
  // by construction rather than by coincidence (ISS-047).
  const assessedScores = skills.filter((s) => s.assessed).map((s) => s.score!);
  const avgScore =
    assessedScores.length > 0
      ? assessedScores.reduce((a, b) => a + b, 0) / assessedScores.length
      : null;
  const currentLevel = avgScore != null ? scoreToCefrBand(avgScore) : "N/A";
  const currentLp18 = avgScore != null ? scoreToLp18(avgScore) : null;

  // 5. Generate lesson recommendations
  const recommendations = await generateLessonPlan(supabase, studentId);

  // 6. Build phased programme — duration, phase count, and per-skill
  // frequency are all derived from the student's actual gap profile
  // (estimateTotalWeeks/buildPhases below), not a fixed template.
  const totalWeeks = estimateTotalWeeks(skills);
  const phases = buildPhases(skills, recommendations, totalWeeks);

  return {
    studentName,
    firstName,
    role: roleName,
    employer: employerName,
    currentLevel,
    currentLp18,
    targetLevel,
    skills,
    supportingSkills,
    recommendations,
    phases,
    totalWeeks,
    // ISS-064/065: this is a free sample, not something the student has
    // enrolled in — the copy must never imply a commitment was made.
    nextStepStatement:
      `This is a preview of what a personalised ${phases.length}-phase, ${totalWeeks}-week ` +
      `programme could look like to reach ${targetLevel} for your role as ${roleName}. ` +
      `Nothing has been booked — if this looks useful, the next step is a quick call.`,
  };
}

/**
 * How many LP18 points/week a student typically closes with consistent
 * multi-skill practice. A first-pass planning heuristic (LP18 spans ~1000
 * points across 18 CEFR sub-bands, so ~55 points/band; a few skills worked
 * concurrently at a realistic pace lands around this rate) — recalibrate
 * against real completion data once enough students have been through a
 * full programme.
 */
const POINTS_PER_WEEK_ESTIMATE = 40;
/** Fallback used only when nothing is assessed yet — the UI labels this an illustrative sample. */
const NA_SAMPLE_WEEKS = 16;
/** Every skill already at/above target — a light maintenance cadence, not a full remediation programme. */
const MAINTENANCE_WEEKS = 4;
const MIN_PROGRAMME_WEEKS = 8;
const MAX_PROGRAMME_WEEKS = 24;

/**
 * Total programme length, derived from how far the student actually is
 * from their target level (sum of positive targetGap across assessed
 * skills) — not a fixed 16 weeks for everyone.
 */
function estimateTotalWeeks(skills: SkillProfile[]): number {
  const assessed = skills.filter((s) => s.assessed);
  if (assessed.length === 0) return NA_SAMPLE_WEEKS;

  const totalGap = assessed.reduce((sum, s) => sum + Math.max(0, s.targetGap ?? 0), 0);
  if (totalGap <= 0) return MAINTENANCE_WEEKS;

  const roundedToTwo = Math.round(totalGap / POINTS_PER_WEEK_ESTIMATE / 2) * 2;
  return Math.min(MAX_PROGRAMME_WEEKS, Math.max(MIN_PROGRAMME_WEEKS, roundedToTwo));
}

function phaseCountFor(totalWeeks: number): number {
  if (totalWeeks <= 6) return 1;
  if (totalWeeks <= 12) return 2;
  if (totalWeeks <= 20) return 3;
  return 4;
}

function phaseNamesFor(count: number): string[] {
  switch (count) {
    case 1:
      return ["Focused sprint"];
    case 2:
      return ["Foundation & Habits", "Consolidation & Confidence"];
    case 4:
      return [
        "Foundation & Habits",
        "Deepening & Challenge",
        "Intensive Practice",
        "Consolidation & Confidence",
      ];
    default:
      return ["Foundation & Habits", "Deepening & Challenge", "Consolidation & Confidence"];
  }
}

/** Splits totalWeeks into `count` contiguous 1-indexed week ranges; the last phase absorbs any remainder. */
function splitWeeks(totalWeeks: number, count: number): { start: number; end: number }[] {
  const base = Math.floor(totalWeeks / count);
  const ranges: { start: number; end: number }[] = [];
  let cursor = 1;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const len = isLast ? totalWeeks - cursor + 1 : base;
    const end = cursor + len - 1;
    ranges.push({ start: cursor, end });
    cursor = end + 1;
  }
  return ranges;
}

function frequencyLabel(priority: PlanRecommendation["priority"]): string {
  switch (priority) {
    case "critical":
      return "3× per week";
    case "recommended":
      return "2× per week";
    default:
      return "1× per week";
  }
}

const MICRO_LESSON_ACTIVITY_LABEL: Record<MicroLessonType, string> = {
  email_sprint: "Email sprints",
  speak_score: "Speak & score",
};

/**
 * Builds the phased programme. Duration/phase-count come from
 * estimateTotalWeeks (the caller); WHICH activities appear and how often
 * come from the student's actual recommendations — the widest gaps get the
 * most reps, and a skill with no gap gets no scheduled practice.
 *
 * When nothing is assessed yet (generateLessonPlan returns every rec as
 * "optional" — no score to size a gap from), falls back to a generic
 * illustrative shape. That's fine: the UI labels the whole section a
 * sample in that case (see the plan/page.tsx N/A banner).
 */
function buildPhases(
  skills: SkillProfile[],
  recs: PlanRecommendation[],
  totalWeeks: number
): PlanPhase[] {
  const phaseCount = phaseCountFor(totalWeeks);
  const names = phaseNamesFor(phaseCount);
  const ranges = splitWeeks(totalWeeks, phaseCount);

  const useGenericSample = skills.every((s) => !s.assessed);
  const actionableRecs = recs.filter((r) => r.priority !== "optional");
  const microLessonRecs = actionableRecs.filter(
    (r): r is PlanRecommendation & { lessonType: MicroLessonType } =>
      r.kind === "micro_lesson" && r.lessonType != null
  );
  const classRecs = actionableRecs.filter((r) => r.kind === "class");
  const anyCriticalClass = classRecs.some((r) => r.priority === "critical");
  const anySpeakingFocus = actionableRecs.some(
    (r) => r.skill === "speaking" || r.skill === "live_interaction"
  );
  const priorityRecSkillLabels = Array.from(
    new Set([...microLessonRecs, ...classRecs].map((r) => r.skillLabel.toLowerCase()))
  );
  const skillList = priorityRecSkillLabels.length > 0 ? priorityRecSkillLabels.join(", ") : "your priority skills";

  return ranges.map(({ start, end }, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === phaseCount - 1;
    const activities: PlanPhase["activities"] = [];

    if (useGenericSample) {
      activities.push({ type: "Email sprints", frequency: "3× per week", skill: "writing" });
      activities.push({ type: "Speak & score", frequency: "2× per week", skill: "speaking" });
      if (!isFirst || phaseCount === 1) {
        activities.push({ type: "Live tutor session", frequency: "1× per week", skill: "all" });
      }
      if (isLast) {
        activities.push({ type: "Role-play simulation", frequency: "2× during phase", skill: "speaking" });
      }
    } else {
      for (const rec of microLessonRecs) {
        activities.push({
          type: MICRO_LESSON_ACTIVITY_LABEL[rec.lessonType],
          frequency: frequencyLabel(rec.priority),
          skill: rec.skill,
        });
      }
      if (classRecs.length > 0 && (anyCriticalClass || !isFirst)) {
        activities.push({
          type: "Live tutor session",
          frequency: anyCriticalClass ? "1× per week" : "1× per fortnight",
          skill: "all",
        });
      }
      if (isLast && anySpeakingFocus) {
        activities.push({ type: "Role-play simulation", frequency: "2× during phase", skill: "speaking" });
      }
    }

    let rationale: string;
    if (useGenericSample) {
      rationale = isFirst
        ? "Build the daily practice habit. Email sprints and speaking sprints are calibrated to your gap profile — " +
          "they adapt as you improve. This phase establishes the routine."
        : isLast
          ? "Consolidate gains with role-specific scenarios and a re-assessment at the end of the programme. " +
            "This phase focuses on confidence and real-world application."
          : "Increase complexity and challenge. Live tutor sessions add real-time feedback and " +
            "conversation practice that self-serve lessons can't replicate.";
    } else {
      rationale = isFirst
        ? `Build the daily practice habit around your biggest gaps: ${skillList}. Frequency scales with how ` +
          "far each skill is from your target — the widest gaps get the most reps."
        : isLast
          ? `Consolidate gains with real-world scenarios and a re-assessment at the end of the programme, ` +
            `applying ${skillList} under pressure.`
          : `Increase complexity and challenge across ${skillList}. Live tutor sessions add real-time feedback ` +
            "that self-serve lessons can't replicate.";
    }

    return {
      name: names[idx],
      weeks: start === end ? `Week ${start}` : `Weeks ${start}–${end}`,
      activities,
      rationale,
    };
  });
}

/**
 * Compile the structured plan into a system prompt for the voice agent.
 * The agent is Aria — the same persona as discovery, but now in
 * "consultant mode" rather than "assessor mode".
 */
export function compilePlanPrompt(plan: PlanData): string {
  const noneAssessedYet = plan.currentLevel === "N/A";

  const skillSummary = plan.skills
    .map((s) => {
      if (!s.assessed) {
        return `- ${s.label}: not yet assessed (role floor: ${s.baseline}/1000)`;
      }
      return (
        `- ${s.label}: ${s.score}/1000 (${s.lp18Band}, ${s.cefrBand}) ` +
        `— role-floor gap: ${s.roleFloorGap}, target-level gap (${plan.targetLevel}): ${s.targetGap}`
      );
    })
    .join("\n");

  const phaseSummary = plan.phases
    .map(
      (p) =>
        `### ${p.name} (${p.weeks})\n` +
        p.activities.map((a) => `  - ${a.type}: ${a.frequency} (${a.skill})`).join("\n") +
        `\n  Why: ${p.rationale}`
    )
    .join("\n\n");

  const priorityItems = plan.recommendations
    .filter((r) => r.priority === "critical" || r.priority === "recommended")
    .map((r) => `- ${r.title} (${r.skillLabel}: ${r.rationale})`)
    .join("\n");

  return `You are Aria, LingoPure's learning consultant. You've just finished assessing ${plan.studentName} — you know their scores, their gaps, and what they need. Now you're sitting down with them to walk through what a personalised programme could look like. This is a FREE SAMPLE — nothing has been booked or charged, and your job is not to close them into a programme. It's to show them the value clearly enough that they want to book a call to talk about the real thing.

## WHO YOU'RE TALKING TO

- Name: ${plan.firstName}
- Role: ${plan.role} at ${plan.employer}
- Current level: ${plan.currentLevel}${plan.currentLp18 ? ` (${plan.currentLp18})` : ""}
- Target level: ${plan.targetLevel}

## THEIR SCORES (out of 1000)

${skillSummary}

## YOUR ASSESSMENT

You've assessed their English across 6 skill dimensions. Your job now is to:
1. Acknowledge where they are — be specific about what's strong and what needs work
2. Explain WHY certain gaps matter for their specific role (${plan.role})
3. Present the sample programme clearly — phases, activities, timeline
4. Invite them to book a call if this looks useful — never push for a yes/no commitment
5. Close warmly — remind them this is a preview and there's a real person to talk to next

## THE SAMPLE PROGRAMME (${plan.totalWeeks} weeks)

${phaseSummary}

## TOP PRIORITY ITEMS

${priorityItems}

## HOW TO DELIVER THIS

1. **Open warmly** — greet by first name, remind them the assessment is done, you have their results
2. **Share scores first** — walk through each skill, starting with strengths, then gaps. Be encouraging but honest. Use their actual numbers.
3. **Connect to their role** — explain why specific gaps matter for ${plan.role} at ${plan.employer}. Make it real.
4. **Present the sample programme** — walk through each phase, what they'd do, how often, and why each piece matters for their gaps. Be clear this is a preview of what's possible, not something they're enrolled in.
5. **Invite the next step** — "This is just a sample of what a real programme could look like for you. If it looks useful, the next step is a quick call with the team to talk through the details — no pressure either way."
6. **If they have questions**, answer briefly but don't oversell — redirect to booking a call for anything specific to their situation.
7. **Close warmly** — "You're at ${plan.currentLevel}, aiming for ${plan.targetLevel} for your role. Hope this gave you a useful picture of what's possible."

${noneAssessedYet ? "## IMPORTANT — NO SCORES YET\n\nThis student hasn't completed their assessment, so every skill above is unassessed. Say so plainly early on — this sample programme is a generic illustration based on typical requirements for their role, not something built from their own results. Encourage them to finish the assessment to get a version personalised to their actual scores.\n" : ""}
## RULES

- Be warm and professional — you're a consultant, not a teacher
- Use their name naturally (not every sentence)
- Reference their ACTUAL scores, not vague estimates${noneAssessedYet ? " — if none exist yet, say so, don't invent them" : ""}
- Be specific about the sample programme — week-by-week, activity-by-frequency
- Never ask for a commitment or a yes/no decision — this is a free preview, not an enrolment
- Invite them to book a call if they're interested — don't push if they're not
- Keep the whole conversation to about 5 minutes
- If the student asks questions about specific lessons, answer briefly but redirect to the programme overview
- Never invent scores or estimates — use only the numbers provided above`;
}

/**
 * Compile a first message for the plan delivery conversation.
 * Short and warm — sets the context and invites them in.
 */
export function compilePlanFirstMessage(plan: PlanData): string {
  return (
    `${plan.firstName}, welcome back. You've just finished your discovery session and ` +
    `assessment exercises — I've got all your results right here. ` +
    `I'm going to walk you through your scores, explain what they mean for your role ` +
    `as ${plan.role} at ${plan.employer}, and then show you a sample ${plan.totalWeeks}-week ` +
    `programme for what it could look like to reach ${plan.targetLevel}. Ready to see how you did?`
  );
}
