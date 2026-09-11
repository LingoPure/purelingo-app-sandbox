import type {
  CanonicalAssessmentResult,
  DiagnosticArchetype,
  Lp1000Band,
  CefrMacroBand,
  RecommendationFamily,
} from "@/lib/2k/contracts";

/**
 * LingoPure 2K — Teacher Intelligence View (C20, ISS-034)
 *
 * Formats the frozen CanonicalAssessmentResult into detailed teacher-facing diagnostic intelligence.
 */

export interface TeacherIntelligenceView {
  assessment_id: string;
  learner_id: string;
  overall: {
    score: number;
    band: Lp1000Band;
    cefr_macro: CefrMacroBand;
    confidence: number;
  };
  diagnosis: {
    archetype: DiagnosticArchetype;
    gap_origin: string;
    confidence: number;
  };
  recommendation: {
    family: RecommendationFamily;
    priority: number;
    exposure: string;
    next_probe?: string;
  };
  telemetry: Array<{
    name: string;
    score: number;
    confidence: number;
  }>;
  state: {
    working: Array<{
      capability: string;
      level: number;
      confidence: number;
      evidence_count: number;
    }>;
    stable: Array<{
      capability: string;
      level: number;
      certified_level: string;
      transition_count: number;
    }>;
  };
  evidence_summary: {
    total_evidence: number;
    accepted: number;
    rejected: number;
    downweighted: number;
  };
  contradictions: Array<{
    evidence_ids: string[];
    description: string;
    severity: "low" | "medium" | "high";
  }>;
}

export function buildTeacherIntelligenceView(
  result: CanonicalAssessmentResult
): TeacherIntelligenceView {
  return {
    assessment_id: result.assessment_id,
    learner_id: result.learner_id,
    overall: {
      score: result.lp1000.score,
      band: result.lp1000.band,
      cefr_macro: result.lp18.stable.cefr_macro,
      confidence: result.lp1000.confidence,
    },
    diagnosis: {
      archetype: result.diagnosis.archetype,
      gap_origin: result.diagnosis.gap_origin,
      confidence: result.diagnosis.confidence,
    },
    recommendation: {
      family: result.recommendation.family,
      priority: result.recommendation.priority,
      exposure: result.recommendation.exposure,
      next_probe: result.recommendation.next_probe,
    },
    telemetry: result.telemetry.dimensions,
    state: {
      working: result.lp18.working.micro_levels.map((m) => ({
        capability: m.capability,
        level: m.level,
        confidence: m.confidence,
        evidence_count: m.evidence_count,
      })),
      stable: result.lp18.stable.micro_levels.map((m) => ({
        capability: m.capability,
        level: m.level,
        certified_level: m.certified_level,
        transition_count: m.transition_count,
      })),
    },
    evidence_summary: result.evidence_summary,
    contradictions: result.contradictions,
  };
}
