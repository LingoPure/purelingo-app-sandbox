import type {
  CanonicalAssessmentResult,
  CefrMacroBand,
  Lp1000Band,
  RecommendationFamily,
} from "@/lib/2k/contracts";

/**
 * LingoPure 2K — Learner Delivery View (C19, ISS-033)
 *
 * Formats the frozen CanonicalAssessmentResult into a learner-friendly summary.
 */

export interface LearnerDeliveryView {
  assessment_id: string;
  score: number;
  band: Lp1000Band;
  cefr_macro: CefrMacroBand;
  recommendation: {
    family: RecommendationFamily;
    priority: number;
    focus: string;
  };
  capabilities: Array<{
    address: string;
    level: string;
    score: number;
  }>;
  summary: {
    strengths: string[];
    next_steps: string[];
  };
}

export function buildLearnerDeliveryView(
  result: CanonicalAssessmentResult
): LearnerDeliveryView {
  const band = result.lp1000.band;
  
  // Extract capability summaries
  const capabilities = result.lp18.stable.micro_levels.map((micro) => {
    // Find corresponding score from components if available
    const key = micro.capability;
    const score = result.lp1000.components[key] ?? 0;

    return {
      address: micro.capability,
      level: micro.certified_level,
      score: Math.round(score),
    };
  });

  // Simple strength/next-step extraction based on score
  const strengths = capabilities
    .filter((c) => c.score >= 600)
    .map((c) => `Strong performance in ${c.address}`);

  const next_steps = [result.recommendation.family === "J" 
    ? "Review held for additional observations" 
    : `Focus on improving: ${result.diagnosis.gap_origin}`
  ];

  return {
    assessment_id: result.assessment_id,
    score: result.lp1000.score,
    band,
    cefr_macro: result.lp18.stable.cefr_macro,
    recommendation: {
      family: result.recommendation.family,
      priority: result.recommendation.priority,
      focus: result.recommendation.exposure,
    },
    capabilities,
    summary: {
      strengths,
      next_steps,
    },
  };
}
