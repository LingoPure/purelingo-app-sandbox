/**
 * LingoPure 2K — deterministic dummy CanonicalAssessmentResult (Phase 1, ISS-013)
 *
 * Thin-MVP placeholder: builds a fully-shaped CanonicalAssessmentResult from the
 * real response evidence (coverage, timing, transcript presence, duration) without
 * invoking the 2K intelligence engines. Scores are deterministic per learner so
 * re-runs and re-displays are stable — never random.
 *
 * Honest-by-construction: every engine version is suffixed "-dummy" and the
 * recommendation family is derived from the weakest telemetry dimension so the
 * shape is real for ISS-014 wiring while nothing is claimed to be measured.
 */

import type {
  CanonicalAssessmentResult,
  LP18StableState,
  LP18WorkingState,
} from "@/lib/2k/contracts";
import { QUESTION_BANK_V1 } from "@/lib/2k/question-bank";

const TOTAL_QUESTIONS = QUESTION_BANK_V1.length;

type SessionRow = {
  assessment_id: string;
  learner_id: string;
  session_id: string;
  question_bank_version: string;
  language: string;
  status: string;
  created_at: string;
};

type ResponseRow = {
  response_id: string;
  question_id: string;
  stage: string;
  task: string;
  client_transcript: string | null;
  duration_ms: number | null;
  upload_status: string;
  processing_status: string;
};

const DIMENSIONS = [
  { name: "fluency", address: "speaking.fluency" },
  { name: "coherence", address: "interaction.coherence" },
  { name: "range", address: "speaking.vocabulary_range" },
  { name: "accuracy", address: "linguistic.grammatical_accuracy" },
  { name: "task_management", address: "task.task_management" },
  { name: "receiver_fit", address: "interaction.receiver_fit" },
] as const;

type CefrMacro = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const FAMILIES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

/** Deterministic 0..1 hash of a string (FNV-1a) — same input → same output. */
function hash01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967295;
}

/** Score 0–1000 from a 0..1 seed, pulled toward a learner-stable central band. */
function seededScore(seed: number, spread: number): number {
  const base = 520 + seed * 260; // 520–780 core band (B1–low C1)
  const wobble = (seed - 0.5) * spread;
  return Math.max(0, Math.min(1000, Math.round(base + wobble)));
}

function bandFor(score: number): CefrMacro {
  if (score >= 900) return "C2";
  if (score >= 800) return "C1";
  if (score >= 680) return "B2";
  if (score >= 560) return "B1";
  if (score >= 440) return "A2";
  return "A1";
}

function confidenceFor(seed: number): number {
  return Math.round((0.6 + seed * 0.25) * 100) / 100; // 0.60–0.85
}

export function buildDummyResult(
  session: SessionRow,
  responses: ResponseRow[]
): CanonicalAssessmentResult {
  const answered = responses.length;
  const withTranscript = responses.filter((r) => r.client_transcript).length;
  const notObserved = TOTAL_QUESTIONS - answered;
  const coveragePct = Math.round((answered / TOTAL_QUESTIONS) * 100);

  const seedBase = hash01(session.learner_id);
  const telemetry = DIMENSIONS.map((d) => {
    const seed = hash01(`${session.learner_id}::${d.name}`);
    const score = seededScore(seed, 140);
    return { name: d.name, address: d.address, score, seed, confidence: confidenceFor(hash01(seed.toFixed(2))) };
  });

  const lp1000Score = Math.round(
    telemetry.reduce((sum, d) => sum + d.score, 0) / telemetry.length
  );
  const cefrMacro = bandFor(lp1000Score);

  // Working state: one micro-level per dimension, realised (observed) rows only.
  const working: LP18WorkingState = {
    micro_levels: telemetry.map((d) => {
      // LP-18 level derived from score: ~1 level per ~53 pts in the mid band.
      const level = Math.max(
        1,
        Math.min(18, Math.round(1 + (d.score - 300) / 38))
      );
      return {
        level,
        capability: d.address,
        evidence_count: responses.filter((r) => r.processing_status === "complete").length || 1,
        confidence: d.confidence,
        coverage: Math.round((answered / TOTAL_QUESTIONS) * 100) / 100,
        last_observed: session.created_at,
      };
    }),
    overall_confidence: Math.min(...telemetry.map((d) => d.confidence)),
    overall_coverage: answered / TOTAL_QUESTIONS,
  };

  // Stable state: certified only where coverage succeeded; otherwise J-control.
  const stable: LP18StableState = {
    micro_levels: telemetry.map((d) => ({
      level: working.micro_levels.find((m) => m.capability === d.address)!.level,
      capability: d.address,
      certified_level: coveragePct >= 50 ? bandFor(d.score) : "NOT_CERTIFIED",
      certified_at: coveragePct >= 50 ? session.created_at : "",
      transition_count: 0,
    })),
    cefr_macro: cefrMacro,
    hysteresis_qualified: false,
  };

  // Weakest dimension drives diagnosis + recommendation family (canonical A–J).
  const sorted = [...telemetry].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  // Weakest position in canonical dimension order (not sorted order) → family.
  const weakestIndex = telemetry.indexOf(weakest);
  const contradictionCount = Math.max(0, telemetry.length - 3);
  const scoreSpread = Math.max(...telemetry.map((d) => d.score)) - Math.min(...telemetry.map((d) => d.score));
  const drift = Math.round((scoreSpread / 1000) * 100) / 100;

  const totalEvidence = responses.length;
  const accepted = responses.filter((r) => r.upload_status === "uploaded").length;
  const rejected = responses.filter((r) => r.upload_status === "failed").length;
  const downweighted =
    responses.filter((r) => r.upload_status === "pending").length || notObserved;

  return {
    result_id: crypto.randomUUID(),
    assessment_id: session.assessment_id,
    learner_id: session.learner_id,

    coverage: {
      total_questions: TOTAL_QUESTIONS,
      answered,
      with_audio: answersCounted(responses),
      with_transcript: withTranscript,
      not_observed: notObserved,
      coverage_pct: coveragePct,
    },

    lp18: { working, stable },

    capabilities: telemetry.map((d) => ({
      address: d.address,
      level: bandFor(d.score),
      confidence: d.confidence,
    })),

    lp1000: {
      score: lp1000Score,
      band: cefrMacro,
      confidence: confidenceFor(seedBase),
      components: telemetry.reduce<Record<string, number>>((acc, d) => {
        acc[d.name] = d.score;
        return acc;
      }, {}),
    },

    telemetry: {
      dimensions: telemetry.map((d) => ({
        name: d.name,
        score: d.score,
        confidence: d.confidence,
      })),
      drift,
      convergence: Math.round((1 - drift) * 100) / 100,
    },

    confidence: confidenceFor(seedBase),
    contradictions:
      contradictionCount > 0
        ? [
            {
              evidence_ids: responses.slice(0, contradictionCount).map((r) => r.response_id),
              description: `Dummy placeholder treated ${contradictionCount}-dimension spread as a contradiction to exercise the contract.`,
              severity: drift > 0.25 ? "high" : "medium",
            },
          ]
        : [],

    diagnosis: {
      archetype: "working_level",
      gap_origin: `${weakest.address} is the binding constraint (dummy derivation)`,
      confidence: confidenceFor(hash01(weakest.name)),
    },

    recommendation: {
      family: FAMILIES[weakestIndex] ?? "J",
      priority: 1,
      exposure: "focused · 20 min · 3×/week",
      next_probe: `Return to the ${weakest.name} dimension with consecutive-task probing (J-control until observed).`,
    },

    evidence_summary: {
      total_evidence: totalEvidence,
      accepted,
      rejected,
      downweighted,
    },

    architecture: {
      brain_version: "2k-dummy",
      ontology_version: "lp18-2k-dummy",
      bank_version: session.question_bank_version,
      rules_version: "r1-r10-dummy",
      question_version: "2k-v1",
      asr_version: "whisper-dev-dummy",
      evidence_version: "ev-dummy",
      lens_version: "lens-dummy",
      report_version: "report-dummy",
    },

    frozen_at: new Date().toISOString(),
    lineage: {
      assessment_id: session.assessment_id,
      session_id: session.session_id,
      response_ids: responses.map((r) => r.response_id),
      analysis_ids: [],
      evidence_ids: [],
      engine_versions: { brain: "2k-dummy", evidence: "ev-dummy" },
    },
  };
}

function answersCounted(responses: ResponseRow[]): number {
  return responses.filter((r) => r.upload_status !== "failed").length;
}