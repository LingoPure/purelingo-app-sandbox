/**
 * POST /api/certifications — schedule a TrackTest exam.
 *
 * Body: { level?: "B1" | "B2" | "C1" }
 *
 * If level is omitted, we recommend the highest level the student is
 * ready to sit (or B1 by default). Creates a certifications row with
 * status='scheduled'. The actual exam is taken at /exam/[id].
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeEligibility, type ExamLevel } from "@/lib/tracktest/eligibility";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

type Body = { level?: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  let level: ExamLevel;

  if (
    body.level === "B1" ||
    body.level === "B2" ||
    body.level === "C1"
  ) {
    level = body.level;
  } else {
    // Auto-recommend from current scores.
    const { data: scoreRows } = await supabase
      .from("gap_scores")
      .select("skill, score")
      .eq("student_id", user.id);

    const scoreMap = Object.fromEntries(
      SKILL_KEYS.map((k) => [k, null as number | null])
    ) as Record<SkillKey, number | null>;
    for (const row of scoreRows ?? []) {
      const r = row as { skill: string; score: number | null };
      if ((SKILL_KEYS as readonly string[]).includes(r.skill)) {
        scoreMap[r.skill as SkillKey] = r.score;
      }
    }
    const eligibility = computeEligibility(scoreMap);
    level = eligibility.ready ?? eligibility.nextLevel;
  }

  const { data, error } = await supabase
    .from("certifications")
    .insert({
      student_id: user.id,
      level,
      status: "scheduled",
    })
    .select("id, level, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...data });
}
