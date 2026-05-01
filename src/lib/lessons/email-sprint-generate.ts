/**
 * Email-sprint lesson generator.
 *
 * Builds a personalized prompt by reading the student's current gap profile +
 * role context, then asks Claude to generate a calibrated scenario.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EmailSprintPromptSchema,
  GENERATOR_SYSTEM_PROMPT,
  type EmailSprintPrompt,
} from "./email-sprint-rubric";
import { SKILL_KEYS } from "@/lib/scoring/rubric";
import {
  loadBaselinesForRole,
  FLAT_FALLBACK_TARGET,
  type Baselines,
} from "@/lib/scoring/baselines";

const MODEL = "claude-sonnet-4-6";

export type GenerateInput = {
  studentId: string;
};

export type StudentContext = {
  targetLevel: string;
  scoresByKey: Record<string, number | null>;
  /** Per-skill baselines from the student's role (or flat 80 fallback). */
  baselines: Baselines;
  /** Role name + description (or null if unassigned). */
  roleName: string | null;
  roleDescription: string | null;
  /** Pulled from discovery_sessions.profile_json — the rich role context. */
  summary: string | null;
  recentScenario: string | null;
};

export async function loadStudentContext(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentContext> {
  const [studentRes, scoresRes, profileRes, lastLessonRes] = await Promise.all([
    supabase
      .from("students")
      .select("target_level, role_id")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("gap_scores")
      .select("skill, score")
      .eq("student_id", studentId),
    supabase
      .from("discovery_sessions")
      .select("profile_json")
      .eq("student_id", studentId)
      .eq("status", "complete")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("micro_lessons")
      .select("content_json")
      .eq("student_id", studentId)
      .eq("type", "email_sprint")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const scoresByKey: Record<string, number | null> = Object.fromEntries(
    SKILL_KEYS.map((k) => [k, null])
  );
  for (const row of scoresRes.data ?? []) {
    scoresByKey[(row as { skill: string }).skill] =
      (row as { score: number | null }).score ?? null;
  }

  const profile = profileRes.data?.profile_json as
    | { summary?: string }
    | null;

  const lastContent = lastLessonRes.data?.content_json as
    | { prompt?: { scenario?: string } }
    | null;

  const roleId = (studentRes.data as { role_id?: string | null } | null)
    ?.role_id;

  // Load role meta + baselines in parallel (only if assigned).
  let roleName: string | null = null;
  let roleDescription: string | null = null;
  let baselines: Baselines;
  if (roleId) {
    const [roleRes, baselineRes] = await Promise.all([
      supabase
        .from("roles")
        .select("name, description")
        .eq("id", roleId)
        .maybeSingle(),
      loadBaselinesForRole(supabase, roleId),
    ]);
    roleName =
      (roleRes.data as { name?: string } | null)?.name ?? null;
    roleDescription =
      (roleRes.data as { description?: string | null } | null)?.description ??
      null;
    baselines = baselineRes;
  } else {
    baselines = Object.fromEntries(
      SKILL_KEYS.map((k) => [k, FLAT_FALLBACK_TARGET])
    ) as Baselines;
  }

  return {
    targetLevel:
      (studentRes.data as { target_level?: string } | null)?.target_level ??
      "B2",
    scoresByKey,
    baselines,
    roleName,
    roleDescription,
    summary: profile?.summary ?? null,
    recentScenario: lastContent?.prompt?.scenario ?? null,
  };
}

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
}

export async function generateEmailSprintPrompt(
  ctx: StudentContext
): Promise<EmailSprintPrompt> {
  const anthropic = client();

  const userMessage = [
    "Generate a calibrated email-sprint prompt for this student.",
    "",
    ctx.roleName
      ? `Role at employer: ${ctx.roleName}`
      : "Role at employer: (unassigned — calibrate to a generic mid-career B2B Vietnamese context)",
    ctx.roleDescription ? `Role description: ${ctx.roleDescription}` : null,
    "",
    `Personal target level (aspiration): ${ctx.targetLevel}`,
    "",
    "Current sub-scores vs role baseline (the buyer's bar — what we calibrate against):",
    ...SKILL_KEYS.map((k) => {
      const cur = ctx.scoresByKey[k];
      const base = ctx.baselines[k];
      const gap = cur == null ? "—" : `gap ${base - cur}`;
      return `  - ${k}: current ${cur ?? "—"} | baseline ${base} | ${gap}`;
    }),
    "",
    "Email-sprint exercises: writing_formal, business_vocabulary, reading_intent.",
    "Calibrate the prompt to close the LARGEST of those three gaps by ~5–10 points on a strong attempt.",
    "",
    "Role / discovery context:",
    ctx.summary
      ? ctx.summary
      : "  (no discovery profile on file — assume mid-career B2B account manager in Vietnam)",
    "",
    ctx.recentScenario
      ? `Their last email-sprint scenario was: "${ctx.recentScenario}". Pick a different one.`
      : "This is their first email sprint.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.7,
    system: [
      {
        type: "text",
        text: GENERATOR_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(EmailSprintPromptSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Generator returned no parsed output");
  return parsed;
}

export async function createEmailSprintLesson(
  supabase: SupabaseClient,
  input: GenerateInput
): Promise<{ id: string; prompt: EmailSprintPrompt }> {
  const ctx = await loadStudentContext(supabase, input.studentId);
  const prompt = await generateEmailSprintPrompt(ctx);

  const beforeAvg = averageRelevant(ctx.scoresByKey);

  const { data, error } = await supabase
    .from("micro_lessons")
    .insert({
      student_id: input.studentId,
      type: "email_sprint",
      skill_focus: "writing_formal",
      content_json: { prompt },
      score_before: beforeAvg,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(`micro_lessons insert failed: ${error.message}`);
  return { id: (data as { id: string }).id, prompt };
}

function averageRelevant(
  scores: Record<string, number | null>
): number | null {
  const relevant = ["writing_formal", "business_vocabulary", "reading_intent"]
    .map((k) => scores[k])
    .filter((s): s is number => s !== null);
  if (relevant.length === 0) return null;
  return Math.round(
    relevant.reduce((sum, n) => sum + n, 0) / relevant.length
  );
}
