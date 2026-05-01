/**
 * Gamification rules — XP awards + tier derivation.
 *
 * Plain numbers, no DB. Callers (route handlers, the seeder) compute the
 * delta and update students.xp / streak_days / last_active_date themselves.
 */

import type { LanguageCode } from "@/lib/i18n/dictionary";

/** XP awarded for each activity. Tune for "feels good in the demo". */
export const XP_REWARDS = {
  lessonSubmit: 50,
  speakScoreSubmit: 75,
  discoveryComplete: 200,
  sessionAttend: 100,
  certificationPass: 500,
} as const;

export type Tier = "bronze" | "silver" | "gold";

/**
 * Tier mapping from CEFR target. The demo's tier badge is aspirational —
 * "what level are you working toward" — not a credit for what you've achieved.
 * (A separate "earned" badge would be added when the student PASSES the exam.)
 */
export function tierForTarget(target?: string | null): Tier {
  const t = (target ?? "").toUpperCase();
  if (t.startsWith("C")) return "gold";
  if (t === "B2") return "silver";
  return "bronze";
}

/** Streak helper — given last_active_date and "today", compute the new streak. */
export function nextStreak(input: {
  lastActive: string | null;
  today: string; // ISO date "YYYY-MM-DD"
  currentStreak: number;
}): { streak: number; lastActive: string } {
  const { lastActive, today, currentStreak } = input;
  if (!lastActive) return { streak: 1, lastActive: today };
  if (lastActive === today) {
    return { streak: Math.max(currentStreak, 1), lastActive: today };
  }
  const last = new Date(`${lastActive}T00:00:00Z`).getTime();
  const cur = new Date(`${today}T00:00:00Z`).getTime();
  const oneDayMs = 86_400_000;
  if (cur - last === oneDayMs) {
    return { streak: currentStreak + 1, lastActive: today };
  }
  // Gap >= 2 days resets the streak.
  return { streak: 1, lastActive: today };
}

/** Today's UTC date string in YYYY-MM-DD form. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Display-friendly tier label, localized. */
export function tierLabel(tier: Tier, lang: LanguageCode): string {
  const map: Record<LanguageCode, Record<Tier, string>> = {
    en: { bronze: "Bronze tier", silver: "Silver tier", gold: "Gold tier" },
    vi: { bronze: "Hạng Đồng", silver: "Hạng Bạc", gold: "Hạng Vàng" },
    tl: { bronze: "Bronze tier", silver: "Silver tier", gold: "Gold tier" },
    id: { bronze: "Tingkat Perunggu", silver: "Tingkat Perak", gold: "Tingkat Emas" },
    ms: { bronze: "Tingkat Gangsa", silver: "Tingkat Perak", gold: "Tingkat Emas" },
    zh: { bronze: "铜级", silver: "银级", gold: "金级" },
  };
  return map[lang]?.[tier] ?? map.en[tier];
}
