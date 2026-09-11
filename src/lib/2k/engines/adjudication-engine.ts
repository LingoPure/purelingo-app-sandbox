import type {
  EvidenceObject,
} from "@/lib/2k/contracts";

/**
 * LingoPure 2K — Adjudication Engine (C09).
 *
 * Implements R1-R10 adjudication logic to filter, weight, and resolve
 * contradictions in the evidence pool.
 */

export interface AdjudicationResult {
  accepted: EvidenceObject[];
  rejected: EvidenceObject[];
  downweighted: EvidenceObject[];
  contradictions: Array<{
    evidence_ids: string[];
    description: string;
    severity: "low" | "medium" | "high";
  }>;
}

export async function adjudicateEvidence(
  evidence: EvidenceObject[]
): Promise<AdjudicationResult> {
  const result: AdjudicationResult = {
    accepted: [],
    rejected: [],
    downweighted: [],
    contradictions: [],
  };

  // Implements R1-R10 rules (placeholders for now):
  // R1: Quality Gate (>0.4)
  // R2: Confidence Gate (>0.5)
  // R3: Modality Consistency
  // R4: Contextual Relevance
  // R5: Temporal Hysteresis
  // R6: Independence Verification
  // R7: Contradiction Resolution
  // R8: Downweighting for Confounds
  // R9: Insufficient Data Handling
  // R10: Authority Hierarchy

  for (const item of evidence) {
    if (item.quality < 0.4) {
      result.rejected.push(item);
      continue;
    }

    if (item.confounds === "HIGH" || item.confounds === "CRITICAL") {
      result.downweighted.push({
        ...item,
        confidence: item.confidence * 0.5,
      });
      continue;
    }

    if (item.status === "CONFLICTED") {
      result.contradictions.push({
        evidence_ids: [item.evidence_id, ...item.counter_evidence],
        description: `Contradiction detected for construct ${item.construct}`,
        severity: "medium",
      });
      result.downweighted.push(item);
      continue;
    }

    result.accepted.push(item);
  }

  return result;
}
