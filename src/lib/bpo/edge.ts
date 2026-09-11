/**
 * BPO Workplace Edge — analysis package (BH-002).
 *
 * Chains C07 (CAO engine) + C08 (Evidence Builder) to transform raw
 * workplace artifacts into structured intelligence packets.
 *
 * This package implements the "Edge" logic described in the target architecture:
 *   1. Accept workplace artifacts (emails/transcripts).
 *   2. Run local analysis (reusing 2K engines).
 *   3. Produce structured observation packets (no raw content exported).
 *   4. Export via the versioned API.
 */

import { randomUUID } from "node:crypto";
import type {
  CommunicationAnalysisObject,
  EvidenceObject,
  AtomicAudioSignal,
} from "@/lib/2k/contracts";
import {
  analyzeCommunication,
  type CommunicationAnalysisInput,
} from "@/lib/2k/engines/communication-analysis";
import { buildEvidencePackets } from "@/lib/2k/engines/evidence-packet-builder";
import { CAPABILITY_TO_SKILL } from "@/lib/bpo/capability-to-skill";
import type { SkillKey } from "@/lib/scoring/rubric";

export interface WorkplaceArtifact {
  artifact_id: string;
  employer_id: string;
  pseudonymous_id: string;
  source_type: "EMAIL" | "CALL_TRANSCRIPT" | "CHAT";
  content: string;
  metadata: Record<string, unknown>;
  created_at?: string;
}

export interface EdgeIntelligencePacket {
  packet_id: string;
  employer_id: string;
  pseudonymous_id: string;
  evidence: EvidenceObject[];
  capability_scores: CapabilityScore[];
  telemetry: {
    dimensions: Record<string, number>;
    confidence: number;
  };
  provenance: {
    engine_version: string;
    artifact_id: string;
    created_at: string;
  };
}

export interface CapabilityScore {
  capability: string;   // CapabilityCode (LIS/VOC/GRM/SPK/RDG/INT)
  skill: SkillKey;      // mapped SkillKey
  score: number;        // 0–1000
  confidence: number;   // 0–1
  evidence_ids: string[];
}

/**
 * Main harness entry point. Transforms a raw workplace artifact into
 * structured intelligence, enforcing the raw-content firewall.
 */
export async function analyzeWorkplaceArtifact(
  artifact: WorkplaceArtifact
): Promise<EdgeIntelligencePacket> {
  const input = mapArtifactToAnalysis(artifact);
  const analysis = analyzeCommunication(input);
  const evidence = await buildEvidencePackets(analysis, {
    engine_version: "bpo-harness-edge-v1",
  });
  const capabilityScores = deriveCapabilityScores(evidence);

  return {
    packet_id: randomUUID(),
    employer_id: artifact.employer_id,
    pseudonymous_id: artifact.pseudonymous_id,
    evidence,
    capability_scores: capabilityScores,
    telemetry: {
      dimensions: extractTelemetry(analysis),
      confidence: analysis.interpretation.competing_explanations.length === 0 ? 0.9 : 0.5,
    },
    provenance: {
      engine_version: "bpo-harness-edge-v1",
      artifact_id: artifact.artifact_id,
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Adapts artifact → 2K CommunicationAnalysisInput.
 */
function mapArtifactToAnalysis(artifact: WorkplaceArtifact): CommunicationAnalysisInput {
  const isEmail = artifact.source_type === "EMAIL";
  const created = artifact.created_at ?? new Date().toISOString();

  return {
    response: {
      response_id: artifact.artifact_id,
      assessment_id: "harness-simulated",
      question_id: "workplace-sim-01",
      stage: "RESOLVE",
      task: isEmail ? "Workplace Communication" : "Workplace Call",
      timing: {
        started_at: created,
        ended_at: created,
        duration_ms: (artifact.metadata.duration_ms as number) ?? 0,
      },
      device: { browser: "harness", os: "harness", is_mobile: false },
      assistance_status: "none",
      upload_status: "uploaded",
      processing_status: "complete",
      created_at: created,
    },
    transcript: isEmail
      ? null
      : {
          transcript_id: `trans-${artifact.artifact_id}`,
          response_id: artifact.artifact_id,
          version: 1,
          text: artifact.content,
          language: "en",
          asr_provider: "harness-simulated",
          asr_version: "v1",
          asr_confidence: 1.0,
          created_at: created,
        },
    signals: [] as AtomicAudioSignal[],
    question: {
      question_id: "workplace-sim-01",
      sequence: 1,
      stage: "RESOLVE",
      prompt: "BPO Workplace communication artifact analysis.",
      contract: {
        required: ["professionalism", "clarity", "intent"],
        constructs: ["speaking_fluency", "listening_comprehension", "writing_formal"],
      },
    },
    context: {
      professionalDomain: "BPO",
      channel: artifact.source_type,
    },
  };
}

/**
 * Derive per-capability 0–1000 scores from C08 evidence packets.
 * Each capability maps to a SkillKey via CAPABILITY_TO_SKILL.
 */
function deriveCapabilityScores(evidence: EvidenceObject[]): CapabilityScore[] {
  const CAPABILITY_CODES = ["LIS", "VOC", "GRM", "SPK", "RDG", "INT"] as const;
  const scores: CapabilityScore[] = [];

  for (const cap of CAPABILITY_CODES) {
    const skill = CAPABILITY_TO_SKILL[cap];
    const packets = evidence.filter((e) => {
      const capPrefix = e.construct.split("-")[0].toUpperCase();
      return capPrefix === cap;
    });

    if (packets.length === 0) {
      scores.push({ capability: cap, skill, score: 0, confidence: 0, evidence_ids: [] });
      continue;
    }

    let weightedSum = 0;
    let weightTotal = 0;
    const evidenceIds: string[] = [];

    for (const pkt of packets) {
      const weight = pkt.confidence;
      weightedSum += pkt.confidence * pkt.quality * 1000 * weight;
      weightTotal += weight;
      evidenceIds.push(pkt.evidence_id);
    }

    const score = weightTotal > 0
      ? Math.round(Math.min(1000, Math.max(0, weightedSum / weightTotal)))
      : 0;
    const avgConfidence = weightTotal > 0
      ? packets.reduce((s, p) => s + p.confidence, 0) / packets.length
      : 0;

    scores.push({ capability: cap, skill, score, confidence: avgConfidence, evidence_ids: evidenceIds });
  }

  return scores;
}

function extractTelemetry(analysis: CommunicationAnalysisObject): Record<string, number> {
  const result: Record<string, number> = {};
  for (const t of analysis.telemetry_evidence) {
    result[t.dimension] = t.score ?? 0;
  }
  return result;
}
