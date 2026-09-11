import type {
  CommunicationAnalysisObject,
  EvidenceObject,
} from "@/lib/2k/contracts";
import { randomUUID } from "node:crypto";

/**
 * LingoPure 2K — Evidence Packet Builder (C08).
 *
 * Transforms CommunicationAnalysisObject observations into governed EvidenceObjects.
 * It maps raw metrics, linguistic scores, and interaction patterns into
 * structured evidence with provenance and confidence.
 */

export interface BuildEvidenceOptions {
  engine_version: string;
  rule_version?: string;
}

export async function buildEvidencePackets(
  analysis: CommunicationAnalysisObject,
  options: BuildEvidenceOptions = { engine_version: "c08-engine-v1" }
): Promise<EvidenceObject[]> {
  const created_at = new Date().toISOString();
  const packets: EvidenceObject[] = [];

  // 1. Transform LP-18 evidence candidates from analysis
  for (const entry of analysis.lp18_evidence) {
    packets.push({
      evidence_id: randomUUID(),
      construct: entry.capability_address,
      observation: `Capability address ${entry.capability_address} identified with contribution ${entry.response_contribution}`,
      status: "OBSERVED", // Default status for direct candidates
      authority: "DIRECT",
      source: {
        modality: analysis.modality,
        response_id: analysis.response_id,
        analysis_id: analysis.analysis_id,
        signal_ids: entry.evidence_ids,
      },
      provenance: {
        engine_version: options.engine_version,
        rule_version: options.rule_version,
        created_at,
      },
      independence: "independent",
      quality: analysis.content_analysis.task_fulfilment,
      task_relevance: entry.response_contribution,
      context_receiver: {
        receiver: analysis.context.receiver,
        context: analysis.context.objective,
      },
      confounds: "NONE", // Default; logic would check for device/channel issues
      confidence: entry.confidence,
      counter_evidence: [],
      created_at,
    });
  }

  // 2. Transform Telemetry evidence
  for (const entry of analysis.telemetry_evidence) {
    packets.push({
      evidence_id: randomUUID(),
      construct: `telemetry.${entry.dimension}`,
      observation: `Telemetry dimension ${entry.dimension} scored ${entry.score ?? "N/A"}`,
      status: entry.evidence_status,
      authority: "DERIVED",
      source: {
        modality: analysis.modality,
        response_id: analysis.response_id,
        analysis_id: analysis.analysis_id,
        signal_ids: entry.evidence_ids,
      },
      provenance: {
        engine_version: options.engine_version,
        rule_version: options.rule_version,
        created_at,
      },
      independence: "independent",
      quality: 1, // Telemetry metrics are usually high quality source measurements
      task_relevance: 1,
      context_receiver: {
        receiver: analysis.context.receiver,
        context: analysis.context.objective,
      },
      confounds: "NONE",
      confidence: entry.confidence,
      counter_evidence: [],
      created_at,
    });
  }

  // 3. Handle Interpretation contradictions as counter-evidence links
  if (analysis.interpretation.counter_evidence.length > 0) {
    // In a full implementation, we would cross-link packet IDs here.
    // For now, we record the intent in the metadata or notes.
  }

  return packets;
}
