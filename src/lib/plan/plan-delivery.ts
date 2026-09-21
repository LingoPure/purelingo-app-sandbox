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
import { generateLessonPlan, type PlanRecommendation } from "@/lib/lessons/plan-generator";

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
  commitmentStatement: string;
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

  let roleName = "your role";
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

  // 6. Build phased programme
  const phases = buildPhases(skills, recommendations);

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
    totalWeeks: 16,
    commitmentStatement:
      `I commit to following the ${phases.length}-phase programme over the next 16 weeks, ` +
      `completing the recommended lessons and attending the scheduled sessions, ` +
      `to reach ${targetLevel} for my role as ${roleName}.`,
  };
}

function buildPhases(
  skills: SkillProfile[],
  recs: PlanRecommendation[]
): PlanPhase[] {
  const criticals = recs.filter((r) => r.priority === "critical");
  const recommended = recs.filter((r) => r.priority === "recommended");

  return [
    {
      name: "Foundation & Habits",
      weeks: "Weeks 1–4",
      activities: [
        { type: "Email sprints", frequency: "3× per week", skill: "writing" },
        { type: "Speak & score", frequency: "2× per week", skill: "speaking" },
        ...(criticals.some((r) => r.kind === "class")
          ? [{ type: "Live tutor session", frequency: "1× per week", skill: "listening" }]
          : []),
      ],
      rationale:
        "Build the daily practice habit. Email sprints and speaking sprints are calibrated to your gap profile — " +
        "they adapt as you improve. This phase establishes the routine.",
    },
    {
      name: "Deepening & Challenge",
      weeks: "Weeks 5–10",
      activities: [
        { type: "Email sprints", frequency: "3× per week", skill: "writing" },
        { type: "Speak & score", frequency: "2× per week", skill: "speaking" },
        { type: "Live tutor session", frequency: "1× per week", skill: "all" },
        ...(recommended.length > 0
          ? [{ type: "Targeted gap closers", frequency: "as assigned", skill: "varies" }]
          : []),
      ],
      rationale:
        "Increase complexity and challenge. Live tutor sessions add real-time feedback and " +
        "conversation practice that self-serve lessons can't replicate.",
    },
    {
      name: "Consolidation & Confidence",
      weeks: "Weeks 11–16",
      activities: [
        { type: "Email sprints", frequency: "2× per week", skill: "writing" },
        { type: "Speak & score", frequency: "2× per week", skill: "speaking" },
        { type: "Live tutor session", frequency: "1× per week", skill: "all" },
        { type: "Role-play simulation", frequency: "2× during phase", skill: "speaking" },
      ],
      rationale:
        "Consolidate gains with role-specific scenarios and a re-assessment at week 16. " +
        "This phase focuses on confidence and real-world application.",
    },
  ];
}

/**
 * Compile the structured plan into a system prompt for the voice agent.
 * The agent is Aria — the same persona as discovery, but now in
 * "consultant mode" rather than "assessor mode".
 */
export function compilePlanPrompt(plan: PlanData): string {
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

  const commitmentOptions = plan.recommendations
    .filter((r) => r.priority === "critical" || r.priority === "recommended")
    .map((r) => `- ${r.title} (${r.skillLabel}: ${r.rationale})`)
    .join("\n");

  return `You are Aria, LingoPure's learning consultant. You've just finished assessing ${plan.studentName} — you know their scores, their gaps, and what they need. Now you're sitting down with them to walk through their improvement programme and get their commitment.

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
3. Present the programme clearly — phases, activities, timeline
4. Get a genuine commitment — not a yes/no, but an agreement to the specific schedule
5. Close warmly — remind them this is achievable and you're with them

## THE PROGRAMME (16 weeks)

${phaseSummary}

## TOP PRIORITY ITEMS

${commitmentOptions}

## HOW TO DELIVER THIS

1. **Open warmly** — greet by first name, remind them the assessment is done, you have their results
2. **Share scores first** — walk through each skill, starting with strengths, then gaps. Be encouraging but honest. Use their actual numbers.
3. **Connect to their role** — explain why specific gaps matter for ${plan.role} at ${plan.employer}. Make it real.
4. **Present the programme** — walk through each phase, what they'll do, how often, and why each piece matters for their gaps
5. **Ask for commitment** — "Based on what I've shared, are you ready to commit to this programme? The 16-week schedule with 3 email sprints a week, 2 speaking sessions, and a weekly tutor session?"
6. **If they hesitate**, address concerns — time, difficulty, cost. Don't push, but help them see the value.
7. **Close with confidence** — "You're at ${plan.currentLevel}, you need ${plan.targetLevel} for your role. 16 weeks of consistent practice will get you there. Let's do this."

## RULES

- Be warm and professional — you're a consultant, not a teacher
- Use their name naturally (not every sentence)
- Reference their ACTUAL scores, not vague estimates
- Be specific about the programme — week-by-week, activity-by-frequency
- Get a genuine commitment, not a forced yes
- End the call after the commitment is confirmed — don't overstay
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
    `as ${plan.role} at ${plan.employer}, and then lay out a clear 16-week programme ` +
    `to get you to ${plan.targetLevel}. Ready to see how you did?`
  );
}
