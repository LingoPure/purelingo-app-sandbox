/**
 * LingoPure 2K — Five-memory layer (C16, ISS-030)
 *
 * Provides a structured storage abstraction for the 2K pipeline's stateful
 * objects.  Memory is versioned and immutable by design (ISS-032 will enforce
 * the freeze).
 *
 * Engine version string: MEM-LAYER-v1.0.0
 */

import type {
  CanonicalAssessmentResult,
  EvidenceObject,
  LP18WorkingState,
  LP18StableState,
  LessonOutcome,
} from "@/lib/2k/contracts";

export const MEM_LAYER_VERSION = "MEM-LAYER-v1.0.0";

// ─── Memory Interfaces ──────────────────────────────────────────────────────

/**
 * Canonical result memory (C17).  One entry per assessment.
 */
export interface CanonicalMemory {
  get(assessmentId: string): CanonicalAssessmentResult | null;
  set(result: CanonicalAssessmentResult): void;
}

/**
 * Evidence packet memory.  Evidence is keyed by evidence_id and
 * scoped to an assessment (or learner, depending on the layer).
 */
export interface EvidenceMemory {
  get(evidenceId: string): EvidenceObject | null;
  getAllByAssessment(assessmentId: string): EvidenceObject[];
  add(evidence: EvidenceObject): void;
}

/**
 * LP-18 state memory (working + stable).
 */
export interface StateMemory {
  get(assessmentId: string): { working: LP18WorkingState; stable: LP18StableState } | null;
  set(assessmentId: string, state: { working: LP18WorkingState; stable: LP18StableState }): void;
}

/**
 * Intervention history memory.  Records applied interventions and outcomes.
 */
export interface InterventionMemory {
  get(outcomeId: string): LessonOutcome | null;
  getAllByAssessment(assessmentId: string): LessonOutcome[];
  add(outcome: LessonOutcome): void;
}

/**
 * Decision memory.  Records key diagnostic and recommendation decisions.
 */
export interface DecisionDecision {
  decision_id: string;
  assessment_id: string;
  archetype: string;
  family: string;
  priority: number;
  attribution: string;
  created_at: string;
}

export interface DecisionMemory {
  get(decisionId: string): DecisionDecision | null;
  getAllByAssessment(assessmentId: string): DecisionDecision[];
  add(decision: DecisionDecision): void;
}

export interface MemoryStore {
  canonical: CanonicalMemory;
  evidence: EvidenceMemory;
  state: StateMemory;
  intervention: InterventionMemory;
  decision: DecisionMemory;
}

// ─── In-Memory Implementation (for testing and thin-MVP) ────────────────────

class InMemoryCanonical implements CanonicalMemory {
  private store = new Map<string, CanonicalAssessmentResult>();

  get(assessmentId: string): CanonicalAssessmentResult | null {
    return this.store.get(assessmentId) ?? null;
  }

  set(result: CanonicalAssessmentResult): void {
    this.store.set(result.assessment_id, result);
  }
}

class InMemoryEvidence implements EvidenceMemory {
  private store = new Map<string, EvidenceObject>();

  get(evidenceId: string): EvidenceObject | null {
    return this.store.get(evidenceId) ?? null;
  }

  getAllByAssessment(assessmentId: string): EvidenceObject[] {
    return Array.from(this.store.values()).filter((e) => e.source.response_id === assessmentId);
  }

  add(evidence: EvidenceObject): void {
    this.store.set(evidence.evidence_id, evidence);
  }
}

class InMemoryState implements StateMemory {
  private store = new Map<string, { working: LP18WorkingState; stable: LP18StableState }>();

  get(assessmentId: string) {
    return this.store.get(assessmentId) ?? null;
  }

  set(assessmentId: string, state: { working: LP18WorkingState; stable: LP18StableState }): void {
    this.store.set(assessmentId, state);
  }
}

class InMemoryIntervention implements InterventionMemory {
  private store = new Map<string, LessonOutcome>();

  get(outcomeId: string): LessonOutcome | null {
    return this.store.get(outcomeId) ?? null;
  }

  getAllByAssessment(assessmentId: string): LessonOutcome[] {
    return Array.from(this.store.values()).filter((o) => o.result_id === assessmentId);
  }

  add(outcome: LessonOutcome): void {
    this.store.set(outcome.outcome_id, outcome);
  }
}

class InMemoryDecision implements DecisionMemory {
  private store = new Map<string, DecisionDecision>();

  get(decisionId: string): DecisionDecision | null {
    return this.store.get(decisionId) ?? null;
  }

  getAllByAssessment(assessmentId: string): DecisionDecision[] {
    return Array.from(this.store.values()).filter((d) => d.assessment_id === assessmentId);
  }

  add(decision: DecisionDecision): void {
    this.store.set(decision.decision_id, decision);
  }
}

export function createInMemoryStore(): MemoryStore {
  return {
    canonical: new InMemoryCanonical(),
    evidence: new InMemoryEvidence(),
    state: new InMemoryState(),
    intervention: new InMemoryIntervention(),
    decision: new InMemoryDecision(),
  };
}
