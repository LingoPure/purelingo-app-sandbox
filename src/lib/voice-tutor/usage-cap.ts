/**
 * Usage cap for on-demand voice-tutor sessions.
 *
 * "Practice whenever you want" is open-ended cost (ElevenLabs minutes +
 * Claude scoring) triggered purely by student volition — per MONETISATION_RULES
 * R12 ("no uncovered cost exposure") this needs a real bound before it ships,
 * not an afterthought. A scheduled session (curriculum-recommended) does NOT
 * count against this cap — it's planned, bounded capacity the curriculum
 * engine already paces; only on-demand sessions are the open-ended case.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Max on-demand sessions a student may start in a rolling 24h window. */
export const DAILY_ON_DEMAND_CAP = 5;

export type UsageCapCheck = {
  allowed: boolean;
  usedToday: number;
  cap: number;
  reason?: string;
};

/** Pure: given a count, decide allow/deny. Kept separate from the DB query
 *  below so the decision logic is unit-testable without a Supabase client. */
export function evaluateUsageCap(usedToday: number, cap = DAILY_ON_DEMAND_CAP): UsageCapCheck {
  if (usedToday >= cap) {
    return {
      allowed: false,
      usedToday,
      cap,
      reason: `Daily practice limit reached (${cap}/day). Try again tomorrow, or ask your coach about a live class.`,
    };
  }
  return { allowed: true, usedToday, cap };
}

export async function checkOnDemandUsageCap(
  supabase: SupabaseClient,
  studentId: string
): Promise<UsageCapCheck> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ai_voice_tutor_sessions")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("trigger", "on_demand")
    .gte("created_at", since);

  if (error) {
    // Fail CLOSED on a count error — an unknown usage count is not the same
    // as a known-safe one, and this gates real external cost.
    return {
      allowed: false,
      usedToday: DAILY_ON_DEMAND_CAP,
      cap: DAILY_ON_DEMAND_CAP,
      reason: "Could not verify today's practice usage — try again shortly.",
    };
  }

  return evaluateUsageCap(count ?? 0);
}
