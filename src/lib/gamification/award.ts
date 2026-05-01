/**
 * Server-side helper for awarding XP + bumping the streak.
 *
 * Called from any route that completes a meaningful student action
 * (lesson submit, scoring complete, session attended). Idempotency is
 * the caller's job — duplicate calls will keep adding XP.
 *
 * Reads + writes go through the service-role client; gamification fields
 * live on `students` and our RLS prohibits self-mutation of xp/streak.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { XP_REWARDS, nextStreak, utcToday } from "./rules";

function adminClient(): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export type XpReward = keyof typeof XP_REWARDS;

/**
 * Award XP and update the streak for a student.
 *
 * Pass either a string `reward` key (uses XP_REWARDS table for the delta)
 * or a numeric `delta` (the rubric-weighted xp_awarded coming back from
 * Claude). Best-effort: if the service-role client isn't configured
 * (local dev without keys) we silently no-op — gamification must never
 * block the real lesson/scoring action.
 */
export async function awardXp(
  studentId: string,
  rewardOrDelta: XpReward | number,
  client?: SupabaseClient
): Promise<{ xp: number; streak: number } | null> {
  const admin = client ?? adminClient();
  if (!admin) return null;

  const { data: row, error: readErr } = await admin
    .from("students")
    .select("xp, streak_days, last_active_date")
    .eq("id", studentId)
    .maybeSingle();
  if (readErr || !row) return null;

  const delta =
    typeof rewardOrDelta === "number"
      ? rewardOrDelta
      : XP_REWARDS[rewardOrDelta];

  const today = utcToday();
  const { streak, lastActive } = nextStreak({
    lastActive: (row.last_active_date as string | null) ?? null,
    today,
    currentStreak: (row.streak_days as number | null) ?? 0,
  });
  const xp = ((row.xp as number | null) ?? 0) + delta;

  const { error: writeErr } = await admin
    .from("students")
    .update({
      xp,
      streak_days: streak,
      last_active_date: lastActive,
    })
    .eq("id", studentId);
  if (writeErr) return null;

  return { xp, streak };
}
