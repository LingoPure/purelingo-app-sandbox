/**
 * POST /api/certifications/[id]/simulate — demo path.
 *
 * Without a real TrackTest partner agreement the demo can't run a real
 * exam. This endpoint synthesises a result from the student's current
 * gap scores: if the average across the relevant sub-skills is at or
 * above the level's CEFR floor, they pass. The result_json carries the
 * full breakdown.
 *
 * Disappears once the real /api/tracktest/webhook is wired.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

const FLOORS: Record<string, number> = {
  A2: 200,
  B1: 400,
  B2: 600,
  C1: 800,
  C2: 900,
};

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: cert, error: certErr } = await supabase
    .from("certifications")
    .select("id, student_id, level, status")
    .eq("id", id)
    .maybeSingle();
  if (certErr) {
    return NextResponse.json({ error: certErr.message }, { status: 500 });
  }
  if (!cert) {
    return NextResponse.json({ error: "Certification not found" }, { status: 404 });
  }
  const certRow = cert as {
    id: string;
    student_id: string;
    level: string;
    status: string;
  };
  if (certRow.student_id !== user.id) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }
  if (certRow.status === "passed" || certRow.status === "failed") {
    return NextResponse.json(
      { error: "Exam already completed" },
      { status: 409 }
    );
  }

  // Pull latest sub-skill scores.
  const { data: scoreRows } = await supabase
    .from("gap_scores")
    .select("skill, score")
    .eq("student_id", user.id);

  const scores = Object.fromEntries(
    SKILL_KEYS.map((k) => [k, null as number | null])
  ) as Record<SkillKey, number | null>;
  for (const row of scoreRows ?? []) {
    const r = row as { skill: string; score: number | null };
    if ((SKILL_KEYS as readonly string[]).includes(r.skill)) {
      scores[r.skill as SkillKey] = r.score;
    }
  }

  const present = (Object.values(scores) as (number | null)[]).filter(
    (n): n is number => typeof n === "number"
  );
  const overall =
    present.length > 0
      ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
      : 0;

  const floor = FLOORS[certRow.level] ?? 60;
  const passed = overall >= floor;

  const result_json = {
    overall_score: overall,
    floor,
    passed,
    sub_scores: scores,
    note: passed
      ? `Passed ${certRow.level}: average ${overall} ≥ floor ${floor}.`
      : `Did not pass ${certRow.level}: average ${overall} below floor ${floor}.`,
    simulated: true,
  };

  const { error: updateErr } = await supabase
    .from("certifications")
    .update({
      status: passed ? "passed" : "failed",
      tracktest_exam_id: `sim-${certRow.id}`,
      result_json,
      issued_at: passed ? new Date().toISOString() : null,
    })
    .eq("id", certRow.id)
    .eq("student_id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    passed,
    overall,
    floor,
    level: certRow.level,
  });
}
