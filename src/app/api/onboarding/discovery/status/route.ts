import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnySkillKey } from "@/lib/scoring/rubric";

/**
 * GET /api/onboarding/discovery/status — poll target for the post-call screen.
 *
 * The voice webhook writes discovery_status = 'complete' (and scores the
 * session) once ElevenLabs reports the call as done. That landing is async
 * relative to the frontend, so the post-call screen polls here instead of
 * racing the webhook with a blind redirect.
 *
 * Once complete, also returns the canonical per-skill gap scores
 * (is_canonical = true — the same rows the dashboard radar reads) so the
 * post-call screen can show "speaking fluency 620 / 1000" straight away.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("students")
    .select("discovery_status")
    .eq("id", user.id)
    .maybeSingle();

  const status =
    (data as { discovery_status?: string | null } | null)?.discovery_status ??
    "not_started";
  const complete = status === "complete";

  let scores: Array<{
    skill: AnySkillKey;
    score: number;
    target: number;
  }> | null = null;

  if (complete) {
    const { data: scoreRows, error: scoreErr } = await supabase
      .from("gap_scores")
      .select("skill, score, target")
      .eq("student_id", user.id)
      .eq("is_canonical", true);
    if (scoreErr) {
      console.error("[discovery/status] gap_scores lookup failed:", scoreErr.message);
    } else {
      scores = (scoreRows ?? []) as Array<{
        skill: AnySkillKey;
        score: number;
        target: number;
      }>;
    }
  }

  return NextResponse.json({
    discovery_status: status,
    complete,
    scores,
  });
}