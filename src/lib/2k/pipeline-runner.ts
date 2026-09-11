/**
 * LingoPure 2K — Pipeline Runner (ISS-036 / Phase 6 wiring)
 *
 * Orchestrates the full C07–C15 engine chain, freezes the result, and stores
 * it in the memory layer.
 */

import type {
  AssessmentSession,
  ResponseObject,
  TranscriptObject,
  AtomicAudioSignal,
  CanonicalAssessmentResult,
  CefrMacroBand,
} from "@/lib/2k/contracts";
import { QUESTION_BANK_V1 } from "@/lib/2k/question-bank";
import { analyzeCommunication } from "@/lib/2k/engines/communication-analysis";
import { buildEvidencePackets } from "@/lib/2k/engines/evidence-packet-builder";
import { adjudicateEvidence } from "@/lib/2k/engines/adjudication-engine";
import { resolveWorkingState } from "@/lib/2k/engines/lp18-state-engine";
import { resolveStableState, trajectoryMomentOf } from "@/lib/2k/engines/hysteresis-engine";
import { resolveTelemetry } from "@/lib/2k/engines/telemetry-engine";
import { resolveLp1000 } from "@/lib/2k/engines/lp1000-engine";
import { diagnose } from "@/lib/2k/engines/diagnostic-engine";
import { resolveRecommendation } from "@/lib/2k/engines/recommendation-control";
import { freezeResult } from "@/lib/2k/result-freeze";
import { currentArchitectureBlock, ENGINE_VERSIONS } from "@/lib/2k/version-registry";

export async function runPipeline(
  session: AssessmentSession,
  responses: ResponseObject[],
  transcripts: TranscriptObject[],
  signals: AtomicAudioSignal[]
): Promise<CanonicalAssessmentResult> {
  const analyses = [];
  const allEvidence = [];

  for (const response of responses) {
    const question = QUESTION_BANK_V1.find((q) => q.question_id === response.question_id) ?? QUESTION_BANK_V1[0];
    const transcript = transcripts.find((t) => t.response_id === response.response_id) ?? null;
    const responseSignals = signals.filter((s) => s.response_id === response.response_id);

    const analysis = analyzeCommunication({
      response,
      transcript,
      signals: responseSignals,
      question,
      context: {
        receiver: response.receiver,
        professionalDomain: session.context.domain,
        languagePair: session.language,
      },
    });
    analyses.push(analysis);

    const evidencePackets = await buildEvidencePackets(analysis);
    allEvidence.push(...evidencePackets);
  }

  const { accepted, rejected, downweighted } = await adjudicateEvidence(allEvidence);
  const working = resolveWorkingState({ acceptedEvidence: accepted });
  const moment = trajectoryMomentOf(working, null);
  const stable = resolveStableState({ working, priorStable: null });
  const telemetry = resolveTelemetry({ analyses });
  const lp1000 = resolveLp1000({ working, stable, telemetry });
  const arc = diagnose({ working, stable, telemetry, lp1000, hysteresis: { working, priorStable: null } });
  const rec = resolveRecommendation({ diagnosis: arc, lp1000, working, trajectory: moment });

  const result: CanonicalAssessmentResult = {
    result_id: "",
    assessment_id: session.assessment_id,
    learner_id: session.learner_id,
    coverage: {
      total_questions: 25,
      answered: responses.length,
      with_audio: responses.filter((r) => r.upload_status === "uploaded").length,
      with_transcript: transcripts.length,
      not_observed: 25 - responses.length,
      coverage_pct: Math.round((responses.length / 25) * 100),
    },
    lp18: { working, stable },
    capabilities: working.micro_levels.map((m) => ({
      address: m.capability,
      level:
        (stable.micro_levels.find((s) => s.capability === m.capability)?.certified_level as CefrMacroBand) ??
        "A1",
      confidence: m.confidence,
    })),
    lp1000,
    telemetry: { ...telemetry, drift: telemetry.drift, convergence: telemetry.convergence },
    confidence: arc.confidence,
    contradictions: [],
    diagnosis: arc,
    recommendation: rec,
    evidence_summary: {
      total_evidence: allEvidence.length,
      accepted: accepted.length,
      rejected: rejected.length,
      downweighted: downweighted.length,
    },
    architecture: currentArchitectureBlock(),
    frozen_at: "",
    lineage: {
      assessment_id: session.assessment_id,
      session_id: session.session_id,
      response_ids: responses.map((r) => r.response_id),
      analysis_ids: analyses.map((a) => a.analysis_id),
      evidence_ids: allEvidence.map((e) => e.evidence_id),
      engine_versions: ENGINE_VERSIONS,
    },
  };

  return freezeResult(result, analyses, allEvidence);
}
