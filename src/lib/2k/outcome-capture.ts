import type {
  LessonOutcome,
  ConfoundLevel,
  EvidenceObject,
  Modality,
} from "@/lib/2k/contracts";
import { randomUUID } from "node:crypto";

/**
 * LingoPure 2K — Teacher Outcome Capture (C21, ISS-035)
 *
 * Captures teacher observations from an intervention and prepares them
 * for the evidence pool to close the feedback loop.
 */

export interface OutcomeInput {
  learner_id: string;
  result_id: string;
  intervention_id?: string;
  teacher_action: string;
  exposure: string;
  learner_response: string;
  teacher_observation: string;
  artifacts: string[];
  confounds: ConfoundLevel;
  confound_notes?: string[];
  outcome_status: "positive" | "neutral" | "negative" | "inconclusive";
  next_action?: string;
}

export function captureLessonOutcome(input: OutcomeInput): LessonOutcome {
  return {
    outcome_id: randomUUID(),
    created_at: new Date().toISOString(),
    ...input,
  };
}

/**
 * Transforms a LessonOutcome into an EvidenceObject to close the loop (G10).
 * This allows teacher observations to influence future state resolutions.
 */
export function outcomeToEvidence(
  outcome: LessonOutcome,
  construct: string
): EvidenceObject {
  return {
    evidence_id: randomUUID(),
    construct,
    observation: outcome.teacher_observation,
    status: outcome.outcome_status === "positive" ? "OBSERVED" : "CONFLICTED",
    authority: "DIRECT", // Teacher observation is treated as direct expert evidence
    source: {
      modality: "interaction" as Modality,
      response_id: outcome.result_id, // Link to the result that triggered the intervention
      analysis_id: outcome.outcome_id,
      signal_ids: outcome.artifacts,
    },
    provenance: {
      engine_version: "teacher-observation-v1",
      created_at: outcome.created_at,
    },
    independence: "independent",
    quality: 0.9, // Human expert observation is high quality
    task_relevance: 1.0,
    context_receiver: {},
    confounds: outcome.confounds,
    confound_notes: outcome.confound_notes,
    counter_evidence: [],
    confidence: outcome.outcome_status === "positive" ? 0.95 : 0.6,
    created_at: outcome.created_at,
  };
}
