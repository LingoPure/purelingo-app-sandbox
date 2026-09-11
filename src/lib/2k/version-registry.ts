/**
 * LingoPure 2K — Version and lineage registry (C17, ISS-031)
 *
 * Defines master versions for every engine and the lineage verification logic
 * that ensures a result was produced by a compatible set of components.
 *
 * Engine version string: VR-LAYER-v1.0.0
 */

import type {
  CanonicalAssessmentResult,
} from "@/lib/2k/contracts";

export const VR_VERSION = "VR-LAYER-v1.0.0";

// ─── Master Engine Versions ─────────────────────────────────────────────────

export const ENGINE_VERSIONS = {
  brain: "2k-brain-v1.0.0",         // C14 Diagnostic
  ontology: "2k-ontology-v1.0.0",   // C10 LP-18 State
  bank: "lp_rec_db-v6.1",          // Diagnostic seeds
  rules: "r1-r10-v1.0.0",          // C09 Adjudication
  question: "2k-question-bank-v1",
  asr: "gpt-4o-transcribe",
  evidence: "ev-packet-v1.0.0",     // C08 Evidence Packet
  lens: "cao-rule-v1.0.0",         // C07 Communication Analysis
  report: "report-v1.0.0",
  telemetry: "TEL-12D-v1.0.0",     // C12 Telemetry
  hysteresis: "HYST-STATE-v1.0.0", // C11 Hysteresis
  lp1000: "LP1000-R-v1.0.0",      // C13 LP-1000
  recommendation: "REC-CONTROL-v1.0.0", // C15 Recommendation
};

export type EngineName = keyof typeof ENGINE_VERSIONS;

/**
 * Verify that a result's architecture block matches the current engine versions.
 * Returns a map of mismatches if any are found.
 */
export function verifyResultVersions(
  result: CanonicalAssessmentResult
): Record<string, { expected: string; actual: string }> {
  const mismatches: Record<string, { expected: string; actual: string }> = {};
  const arch = result.architecture;

  const check = (key: EngineName, actual: string | undefined) => {
    const expected = ENGINE_VERSIONS[key];
    if (actual && actual !== expected) {
      mismatches[key] = { expected, actual };
    }
  };

  check("brain", arch.brain_version);
  check("ontology", arch.ontology_version);
  check("bank", arch.bank_version);
  check("rules", arch.rules_version);
  check("question", arch.question_version);
  check("evidence", arch.evidence_version);
  check("lens", arch.lens_version);
  check("report", arch.report_version);
  check("asr", arch.asr_version);

  return mismatches;
}

/**
 * Populate the architecture block from current master versions.
 * The contract uses *_version keys; ENGINE_VERSIONS uses bare names.
 */
export function currentArchitectureBlock(): CanonicalAssessmentResult["architecture"] {
  return {
    brain_version:       ENGINE_VERSIONS.brain,
    ontology_version:    ENGINE_VERSIONS.ontology,
    bank_version:        ENGINE_VERSIONS.bank,
    rules_version:       ENGINE_VERSIONS.rules,
    question_version:    ENGINE_VERSIONS.question,
    asr_version:         ENGINE_VERSIONS.asr,
    evidence_version:    ENGINE_VERSIONS.evidence,
    lens_version:        ENGINE_VERSIONS.lens,
    report_version:      ENGINE_VERSIONS.report,
  };
}

/**
 * Append a response ID to the lineage if not already present.
 */
export function addResponseToLineage(
  lineage: CanonicalAssessmentResult["lineage"],
  responseId: string
): CanonicalAssessmentResult["lineage"] {
  if (lineage.response_ids.includes(responseId)) return lineage;
  return { ...lineage, response_ids: [...lineage.response_ids, responseId] };
}
