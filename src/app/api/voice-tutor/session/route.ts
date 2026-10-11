/**
 * POST /api/voice-tutor/session — start an AI voice-tutor drill session.
 *
 * Body: { targetSkill?: AnySkillKey; trigger: "scheduled" | "on_demand" }
 *   - "on_demand": targetSkill optional — defaults to the student's biggest
 *     current gap among the 4 voice-native skills. Gated by the usage cap
 *     (usage-cap.ts) — this is the open-ended "I need to practise X, right
 *     now" path, so it's the one that needs the bound.
 *   - "scheduled": targetSkill required (the curriculum recommendation that
 *     triggered it). Not usage-capped — the curriculum engine already paces
 *     scheduled recommendations.
 *
 * Mirrors /api/plan/session: resolve the agent, compile a per-session
 * prompt override from real data, mint a signed session token, return
 * everything the VoiceWidget needs. Records an ai_voice_tutor_sessions row
 * up front (status='pending') so the usage-cap count and session history
 * both have something to query even before the call connects.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintAnonSessionToken } from "@caistech/elevenlabs-convai";
import { resolveVoiceTutorAgentId } from "@/lib/voice-tutor/resolve-agent";
import { compileVoiceTutorPrompt, compileVoiceTutorFirstMessage } from "@/lib/voice-tutor/config";
import { checkOnDemandUsageCap } from "@/lib/voice-tutor/usage-cap";
import { loadBaselinesForStudent, FLAT_FALLBACK_TARGET } from "@/lib/scoring/baselines";
import type { AnySkillKey } from "@/lib/scoring/rubric";
import { VOICE_DRILLABLE_SKILLS, isDrillableSkill } from "@/lib/voice-tutor/drillable-skills";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const trigger = body?.trigger === "scheduled" ? "scheduled" : "on_demand";
  const requestedSkill = isDrillableSkill(body?.targetSkill) ? body.targetSkill : null;

  if (trigger === "scheduled" && !requestedSkill) {
    return NextResponse.json(
      { error: "targetSkill is required for a scheduled session" },
      { status: 400 }
    );
  }

  if (trigger === "on_demand") {
    const usage = await checkOnDemandUsageCap(supabase, user.id);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason, usedToday: usage.usedToday, cap: usage.cap },
        { status: 429 }
      );
    }
  }

  const agentId = await resolveVoiceTutorAgentId();
  if (!agentId) {
    return NextResponse.json(
      { error: "Voice tutor agent not configured (ELEVENLABS_VOICE_TUTOR_AGENT_ID missing)" },
      { status: 500 }
    );
  }

  try {
    const { data: student } = await supabase
      .from("students")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const firstName = ((student?.name as string | undefined) ?? "there").split(" ")[0];

    const { data: scoreRows } = await supabase
      .from("gap_scores")
      .select("skill, score, target")
      .eq("student_id", user.id)
      .eq("is_canonical", true)
      .in("skill", VOICE_DRILLABLE_SKILLS);

    const baselines = await loadBaselinesForStudent(supabase, user.id);
    const baselinesAny = baselines as Partial<Record<AnySkillKey, number>>;

    type Row = { skill: AnySkillKey; score: number | null; target: number | null };
    const rows = (scoreRows ?? []) as Row[];
    const byskill = new Map(rows.map((r) => [r.skill, r]));

    // On-demand with no skill given: pick the biggest current gap among the
    // 4 drillable skills; an unassessed skill (no row yet) counts as a full
    // gap so a brand-new student still gets a sensible default.
    const targetSkill: AnySkillKey =
      requestedSkill ??
      VOICE_DRILLABLE_SKILLS.reduce((best, skill) => {
        const row = byskill.get(skill);
        const baseline = row?.target ?? baselinesAny[skill] ?? FLAT_FALLBACK_TARGET;
        const gap = row?.score == null ? baseline : Math.max(0, baseline - row.score);
        const bestRow = byskill.get(best);
        const bestBaseline = bestRow?.target ?? baselinesAny[best] ?? FLAT_FALLBACK_TARGET;
        const bestGap = bestRow?.score == null ? bestBaseline : Math.max(0, bestBaseline - bestRow.score);
        return gap > bestGap ? skill : best;
      }, VOICE_DRILLABLE_SKILLS[0] as AnySkillKey);

    const row = byskill.get(targetSkill);
    const baseline = row?.target ?? baselinesAny[targetSkill] ?? FLAT_FALLBACK_TARGET;

    const promptOverride = compileVoiceTutorPrompt({
      studentFirstName: firstName,
      targetSkill,
      currentScore: row?.score ?? null,
      baseline,
    });
    const firstMessage = compileVoiceTutorFirstMessage({
      studentFirstName: firstName,
      targetSkill,
      currentScore: row?.score ?? null,
      baseline,
    });

    const { token } = mintAnonSessionToken(
      process.env.DISCOVERY_SESSION_SECRET || "temp-secret",
      { agentId, sid: user.id }
    );

    const admin = createAdminClient();
    const { data: sessionRow, error: insertErr } = await admin
      .from("ai_voice_tutor_sessions")
      .insert({
        student_id: user.id,
        target_skill: targetSkill,
        trigger,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr) {
      console.error("[voice-tutor/session] session row insert failed:", insertErr.message);
    }

    return NextResponse.json({
      token,
      agentId,
      promptOverride,
      firstMessage,
      targetSkill,
      sessionId: (sessionRow as { id?: string } | null)?.id ?? null,
    });
  } catch (err) {
    console.error("[voice-tutor/session] start failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start voice-tutor session" },
      { status: 500 }
    );
  }
}
