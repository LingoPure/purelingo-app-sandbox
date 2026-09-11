/**
 * CAPABILITY_TO_SKILL — BH-004 declared mapping contract.
 *
 * Maps 2K capability codes (C07 engine: LIS/VOC/GRM/SPK/RDG/INT) onto the
 * existing 6-skill employer scoring model (gap_scores.SkillKey) so the same
 * workplace analysis lights up both the 2K capability layer AND the existing
 * employer radar/roster rollup.
 *
 * A single declared constant: removing or changing a line changes behaviour
 * for every consumer (Edge harness, rollup, gate runs). Do not duplicate this
 * map elsewhere.
 */

import type { CapabilityCode } from "@/lib/2k/engines/communication-analysis";
import type { SkillKey } from "@/lib/scoring/rubric";

export const CAPABILITY_TO_SKILL: Record<CapabilityCode, SkillKey> = {
  SPK: "speaking_fluency",        // speaking fluency
  LIS: "listening_comprehension", // listening comprehension
  RDG: "reading_intent",          // reading intent
  VOC: "business_vocabulary",     // business vocabulary
  INT: "presentation_delivery",   // presentation delivery
  GRM: "writing_formal",          // formal writing
};

export const SKILL_TO_CAPABILITY: Record<SkillKey, CapabilityCode> = {
  speaking_fluency: "SPK",
  listening_comprehension: "LIS",
  writing_formal: "GRM",
  reading_intent: "RDG",
  business_vocabulary: "VOC",
  presentation_delivery: "INT",
};