/**
 * LingoPure 2K — G1–G14 launch acceptance gates (Phase 0, ISS-010)
 *
 * The fourteen commercial launch gates, frozen verbatim from the CEFR
 * Commercial Implementation Master §15 (Launch acceptance gates) and §16
 * (Test matrix).  These constants are the machine-readable gate contract that
 * ISS-042 runs against real external test users; the Phase 7 hardening issues
 * (ISS-038..041) each land against one or more of these gates.
 *
 * Source: LingoPure_CEFR_Demo_2K_Teacher_Commercial_Implementation_Master.docx
 *         §15 (gates) + §16 (test matrix)
 * Frozen: 2026-09-11
 */

/** How a gate is proven. */
export type GateVerification = "automated" | "device" | "manual";

/** Test-matrix class (§16). */
export type TestClass =
  | "Functional"
  | "Device"
  | "Governance"
  | "Determinism"
  | "Recovery"
  | "Consistency"
  | "Closed loop"
  | "Security";

export interface AcceptanceGate {
  id: string;                 // "G1" … "G14"
  area: string;               // identity, capture, governance, …
  pass_condition: string;     // verbatim pass condition from §15
  verification: GateVerification;
  /** Hardening issues that make this gate pass. */
  blocking_issues: string[];
}

export interface TestMatrixEntry {
  id: string;                 // stable test key
  test_class: TestClass;
  test: string;               // §16 test name
  pass_expectation: string;   // §16 pass expectation
  gate: string;               // primary acceptance gate this evidences
}

/** The fourteen launch acceptance gates (§15). */
export const ACCEPTANCE_GATES: AcceptanceGate[] = [
  {
    id: "G1",
    area: "Identity & resume",
    pass_condition: "Learner can start, leave and resume without losing valid responses.",
    verification: "automated",
    blocking_issues: ["ISS-038"],
  },
  {
    id: "G2",
    area: "Cross-device capture",
    pass_condition:
      "Supported desktop/mobile devices capture and upload all 25 responses reliably.",
    verification: "device",
    blocking_issues: ["ISS-038"],
  },
  {
    id: "G3",
    area: "Durable evidence",
    pass_condition:
      "Audio, transcript versions, response metadata and provenance are retrievable by IDs.",
    verification: "automated",
    blocking_issues: ["ISS-030", "ISS-032"],
  },
  {
    id: "G4",
    area: "2K authority",
    pass_condition:
      "Production result comes from backend 2K; frontend local scoring is not production authority.",
    verification: "automated",
    blocking_issues: ["ISS-032"],
  },
  {
    id: "G5",
    area: "Governance",
    pass_condition:
      "Missing/confounded/contradictory evidence behaves according to evidence laws and J probe/hold.",
    verification: "automated",
    blocking_issues: [],
  },
  {
    id: "G6",
    area: "State safety",
    pass_condition:
      "One event cannot arbitrarily rewrite stable LP-18; transition/hysteresis is enforced.",
    verification: "automated",
    blocking_issues: [],
  },
  {
    id: "G7",
    area: "Canonical freeze",
    pass_condition:
      "Result is immutable, versioned and reproducible with complete lineage.",
    verification: "automated",
    blocking_issues: ["ISS-031", "ISS-032"],
  },
  {
    id: "G8",
    area: "Surface consistency",
    pass_condition:
      "Learner, teacher and report resolve to the same result_id/state.",
    verification: "automated",
    blocking_issues: ["ISS-033", "ISS-034"],
  },
  {
    id: "G9",
    area: "Teacher readiness",
    pass_condition:
      "Teacher receives intelligence before demo and can record outcome against intervention/result.",
    verification: "manual",
    blocking_issues: ["ISS-034", "ISS-035"],
  },
  {
    id: "G10",
    area: "Closed loop",
    pass_condition:
      "Outcome becomes new evidence without rewriting historical raw observations.",
    verification: "automated",
    blocking_issues: ["ISS-037"],
  },
  {
    id: "G11",
    area: "Recovery",
    pass_condition:
      "Failures at upload/ASR/analysis/freeze/report can recover without losing prior valid evidence.",
    verification: "automated",
    blocking_issues: ["ISS-039", "ISS-040"],
  },
  {
    id: "G12",
    area: "Operations",
    pass_condition:
      "Team can trace every assessment and identify processing state/failure.",
    verification: "automated",
    blocking_issues: ["ISS-040"],
  },
  {
    id: "G13",
    area: "Security",
    pass_condition:
      "Authentication/authorization/media controls and retention rules are implemented.",
    verification: "automated",
    blocking_issues: ["ISS-041"],
  },
  {
    id: "G14",
    area: "E2E commercial",
    pass_condition:
      "A real external learner completes assessment → teacher receives intelligence → demo outcome returns to 2K.",
    verification: "manual",
    blocking_issues: ["ISS-036", "ISS-042"],
  },
];

export const ACCEPTANCE_GATE_BY_ID: Record<string, AcceptanceGate> =
  Object.fromEntries(ACCEPTANCE_GATES.map((gate) => [gate.id, gate]));

/** The §16 test matrix, each row pinned to its primary gate. */
export const TEST_MATRIX: TestMatrixEntry[] = [
  {
    id: "T_FUNC_25Q",
    test_class: "Functional",
    test: "25Q happy path",
    pass_expectation:
      "25 responses stored; result generated; learner/teacher delivery ready.",
    gate: "G14",
  },
  {
    id: "T_FUNC_RESUME13",
    test_class: "Functional",
    test: "Resume at Q13",
    pass_expectation: "Q1-12 retained; Q13 resumes; no duplicate evidence.",
    gate: "G1",
  },
  {
    id: "T_DEV_IOS",
    test_class: "Device",
    test: "iPhone Safari",
    pass_expectation: "Audio capture/upload + server ASR path completes.",
    gate: "G2",
  },
  {
    id: "T_DEV_ANDROID",
    test_class: "Device",
    test: "Android Chrome",
    pass_expectation: "Audio capture/upload completes.",
    gate: "G2",
  },
  {
    id: "T_DEV_DESKTOP",
    test_class: "Device",
    test: "Desktop Chrome/Safari",
    pass_expectation: "Mic, recording and processing complete.",
    gate: "G2",
  },
  {
    id: "T_GOV_NO_AUDIO",
    test_class: "Governance",
    test: "No audio signal",
    pass_expectation: "Signal null/NOT_OBSERVED; coverage lowers; no fake weakness.",
    gate: "G5",
  },
  {
    id: "T_GOV_LOW_ASR",
    test_class: "Governance",
    test: "Low ASR confidence",
    pass_expectation:
      "Transcript quality lowers; learner capability not directly penalized.",
    gate: "G5",
  },
  {
    id: "T_GOV_CONTRADICT",
    test_class: "Governance",
    test: "Contradictory answers",
    pass_expectation:
      "Confidence lowers and next probe/J logic activates where material.",
    gate: "G5",
  },
  {
    id: "T_GOV_EXTREME",
    test_class: "Governance",
    test: "Single extreme answer",
    pass_expectation: "Stable LP-18 remains protected by hysteresis.",
    gate: "G6",
  },
  {
    id: "T_DET_SAME_EVIDENCE",
    test_class: "Determinism",
    test: "Same evidence + versions",
    pass_expectation:
      "Historical decision trace/result is reproducible where deterministic.",
    gate: "G7",
  },
  {
    id: "T_REC_DUP_UPLOAD",
    test_class: "Recovery",
    test: "Duplicate upload",
    pass_expectation: "No duplicate response/evidence created.",
    gate: "G11",
  },
  {
    id: "T_REC_ASR_OUTAGE",
    test_class: "Recovery",
    test: "ASR outage",
    pass_expectation: "Raw audio preserved; retry/fallback works.",
    gate: "G11",
  },
  {
    id: "T_REC_BRAIN_TIMEOUT",
    test_class: "Recovery",
    test: "Brain timeout",
    pass_expectation: "Assessment remains recoverable; no partial result exposed.",
    gate: "G11",
  },
  {
    id: "T_CONS_LEARNER_TEACHER",
    test_class: "Consistency",
    test: "Learner vs teacher",
    pass_expectation: "Same result_id, LP-18, LP-1000 and frozen state.",
    gate: "G8",
  },
  {
    id: "T_LOOP_OUTCOME",
    test_class: "Closed loop",
    test: "Teacher outcome",
    pass_expectation: "Outcome linked to intervention/result and becomes new evidence.",
    gate: "G10",
  },
  {
    id: "T_SEC_MEDIA",
    test_class: "Security",
    test: "Unauthorized media access",
    pass_expectation: "Denied and logged.",
    gate: "G13",
  },
];
