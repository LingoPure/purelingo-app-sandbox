import type {
  CanonicalAssessmentResult,
  AssessmentSession,
  EvidenceObject,
  CommunicationAnalysisObject,
} from "@/lib/2k/contracts";
import { randomUUID } from "node:crypto";

/**
 * LingoPure 2K — Canonical Result Freeze Engine (C18, ISS-032).
 *
 * Provides two entry points:
 *  - `freezeCanonicalResult(assessment, result)` — the low-level freeze that
 *    stamps result_id + frozen_at and completes lineage from an assembled
 *    partial result.
 *  - `freezeResult(result, analyses, evidence)` — the pipeline-friendly freeze
 *    used by ISS-036, which fills lineage from the run's analyses/evidence and
 *    stamps the immutable frozen_at.
 */

/** Low-level freeze: assign identity, frozen_at and lineage from the session. */
export async function freezeCanonicalResult(
  assessment: AssessmentSession,
  result: Omit<CanonicalAssessmentResult, "result_id" | "frozen_at" | "lineage">
): Promise<CanonicalAssessmentResult> {
  return {
    ...result,
    result_id: randomUUID(),
    frozen_at: new Date().toISOString(),
    lineage: {
      assessment_id: assessment.assessment_id,
      session_id: assessment.session_id,
      response_ids: [],
      analysis_ids: [],
      evidence_ids: [],
      engine_versions: { brain: "2k-v1", evidence: "2k-v1" },
    },
  };
}

/** Pipeline freeze: complete lineage from the run and stamp frozen_at. */
export function freezeResult(
  result: CanonicalAssessmentResult,
  analyses: CommunicationAnalysisObject[],
  evidence: EvidenceObject[]
): CanonicalAssessmentResult {
  return {
    ...result,
    result_id: result.result_id || randomUUID(),
    frozen_at: result.frozen_at || new Date().toISOString(),
    lineage: {
      ...result.lineage,
      assessment_id: result.assessment_id,
      response_ids: [
        ...new Set([
          ...result.lineage.response_ids,
          ...analyses.map((a) => a.response_id),
        ]),
      ],
      analysis_ids: analyses.map((a) => a.analysis_id),
      evidence_ids: evidence.map((e) => e.evidence_id),
    },
  };
}

/** A result is frozen once it carries a frozen_at timestamp. */
export function isFrozen(result: CanonicalAssessmentResult): boolean {
  return Boolean(result.frozen_at);
}
