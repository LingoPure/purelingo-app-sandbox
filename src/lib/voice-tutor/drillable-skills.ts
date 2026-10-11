import type { AnySkillKey } from "@/lib/scoring/rubric";

/** The 4 voice-native skills a drill session can target — the same set
 *  plan-generator.ts routes to "ai_voice" recommendations. Single source so
 *  the session-start API and the /practice page agree on what's valid. */
export const VOICE_DRILLABLE_SKILLS = [
  "speaking",
  "listening",
  "grammar",
  "live_interaction",
] as const satisfies readonly AnySkillKey[];

export type VoiceDrillableSkill = (typeof VOICE_DRILLABLE_SKILLS)[number];

export function isDrillableSkill(value: unknown): value is VoiceDrillableSkill {
  return (VOICE_DRILLABLE_SKILLS as readonly string[]).includes(value as string);
}
