import type {
  LessonOutcome,
  ConfoundLevel,
} from "@/lib/2k/contracts";
import { randomUUID } from "node:crypto";

/**
 * LingoPure 2K — Teacher Outcome Capture (C21, ISS-035)
 *
 * Captures the teacher's observation and intervention outcome, linking it to the
 * specific assessment and intervention family.
 */

export interface OutcomeCaptureInput {
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

export function captureTeacherOutcome(
  input: OutcomeCaptureInput
): LessonOutcome {
  return {
    outcome_id: randomUUID(),
    learner_id: input.learner_id,
    result_id: input.result_id,
    intervention_id: input.intervention_id,
    teacher_action: input.teacher_action,
    exposure: input.exposure,
    learner_response: input.learner_response,
    teacher_observation: input.teacher_observation,
    artifacts: input.artifacts,
    confounds: input.confounds,
    confound_notes: input.confound_notes,
    outcome_status: input.outcome_status,
    next_action: input.next_action,
    created_at: new Date().toISOString(),
  };
}
