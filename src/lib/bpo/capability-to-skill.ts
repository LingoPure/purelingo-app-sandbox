/**
 * CAPABILITY_TO_SKILL — BH-004 declared mapping contract.
 *
 * Maps 2K capability codes (C07 engine: LIS/VOC/GRM/SPK/RDG/INT) onto the
 * ISS-048 taxonomy (gap_scores.AnySkillKey) so the same workplace analysis
 * lights up both the 2K capability layer AND the employer radar/roster
 * rollup.
 *
 * Under the six-primary/two-supporting taxonomy this mapping is fully
 * self-consistent for the first time: GRM (grammar) really means grammar,
 * INT (interaction) really means live_interaction, VOC (vocabulary) is the
 * supporting business_vocabulary measure, unchanged. There is no 2K
 * capability code for "writing" — 2K's 6-letter model doesn't have one
 * (Dennis: "writing is a separate modality") — so SKILL_TO_CAPABILITY is a
 * partial map, not exhaustive over every skill.
 *
 * A single declared constant: removing or changing a line changes behaviour
 * for every consumer (Edge harness, rollup, gate runs). Do not duplicate this
 * map elsewhere.
 */

import type { CapabilityCode } from "@/lib/2k/engines/communication-analysis";
import type { AnySkillKey } from "@/lib/scoring/rubric";

export const CAPABILITY_TO_SKILL: Record<CapabilityCode, AnySkillKey> = {
  SPK: "speaking",             // speaking
  LIS: "listening",            // listening
  RDG: "reading",              // reading
  VOC: "business_vocabulary",  // business vocabulary (supporting)
  INT: "live_interaction",     // live interaction
  GRM: "grammar",              // grammar
};

/** Partial — "writing" and "presentation_delivery" have no 2K capability code. */
export const SKILL_TO_CAPABILITY: Partial<Record<AnySkillKey, CapabilityCode>> = {
  speaking: "SPK",
  listening: "LIS",
  reading: "RDG",
  business_vocabulary: "VOC",
  live_interaction: "INT",
  grammar: "GRM",
};