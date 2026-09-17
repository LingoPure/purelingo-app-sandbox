/**
 * Battery-complete report trigger (Phase 0b → "taste → report → book a demo").
 *
 * Called from reconcileBatteryScore after each task reconciles. Fires the
 * report email exactly once — when the last of the four battery skills has a
 * canonical battery_task score — guarded by students.battery_report_sent_at.
 *
 * Everything in here is best-effort: a failed email must never break the
 * canonical score write that called us.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_SKILL } from "./types";
import { sendBatteryReportEmail } from "@/lib/email/battery-report";

const BATTERY_SKILLS = Array.from(new Set(Object.values(TASK_SKILL)));

const SKILL_LABELS: Record<string, string> = {
  writing_formal: "Formal writing",
  listening_comprehension: "Listening comprehension",
  reading_intent: "Reading for intent",
  business_vocabulary: "Business vocabulary",
};

type BatterySkill = (typeof BATTERY_SKILLS)[number];

async function appOrigin(): Promise<string> {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://purelingo-app-sandbox.vercel.app"
  );
}

export async function sendBatteryCompleteReport(
  supabase: SupabaseClient,
  studentId: string
): Promise<void> {
  try {
    const { data: skillRows } = await supabase
      .from("gap_scores")
      .select("skill, score")
      .eq("student_id", studentId)
      .eq("is_canonical", true)
      .eq("source", "battery_task")
      .in("skill", BATTERY_SKILLS);

    const scored = (skillRows ?? []) as { skill: BatterySkill; score: number }[];
    if (scored.length < BATTERY_SKILLS.length) return; // battery not complete yet

    const { data: student } = await supabase
      .from("students")
      .select("name, email, employer_id, battery_report_sent_at")
      .eq("id", studentId)
      .maybeSingle();

    if (!student || !student.email) return;
    if (student.battery_report_sent_at) return; // already mailed

    let company: string | null = null;
    if (student.employer_id) {
      const { data: employer } = await supabase
        .from("employers")
        .select("name")
        .eq("id", student.employer_id)
        .maybeSingle();
      company = ((employer as { name?: string } | null)?.name) ?? null;
    }

    const skills = Array.from(new Set(scored.map((s) => s.skill)))
      .map((skill) => ({
        label: SKILL_LABELS[skill] ?? skill,
        score: scored.find((s) => s.skill === skill)?.score ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    if (skills.length === 0) return;

    const mail = await sendBatteryReportEmail({
      to: student.email,
      name: (student.name as string | null) ?? null,
      company,
      origin: await appOrigin(),
      skills,
    });

    if (mail.ok) {
      await supabase
        .from("students")
        .update({ battery_report_sent_at: new Date().toISOString() })
        .eq("id", studentId);
    } else {
      console.error("[battery-report] send failed", { studentId, message: mail.error });
    }
  } catch (err) {
    console.error("[battery-report] unexpected failure", {
      studentId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}