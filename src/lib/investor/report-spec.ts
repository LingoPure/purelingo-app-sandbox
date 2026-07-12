// The investor ReportSpec + capability manifest — LingoPure's report CATALOGUE,
// built on @caistech/dataroom-core's generic report contract. The schema shape,
// title strategy, and manifest builder come from the package; the report types +
// capabilities (the product content) live here and are injected into the engine.
//
// Tier is NOT part of the spec — the run route derives allowed tiers from the
// investor's server-side max_tier (the NDA gate), so a client can never widen scope.

import {
  makeReportSpecSchema,
  makeDefaultTitleFor,
  capabilityFor as capabilityForCore,
  capabilityManifestForLLM as capabilityManifestForLLMCore,
  type ReportCapability,
  type ReportSpec as CoreReportSpec,
} from "@caistech/dataroom-core";

export type { ReportCapability };

export const REPORT_TYPES = [
  "investment_memo",
  "dd_summary",
  "financials_brief",
  "traction_summary",
  "team_and_captable",
  "tech_defensibility",
  "risk_register",
  "custom",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const ReportSpecSchema = makeReportSpecSchema(REPORT_TYPES);
// Typed structurally from the package's contract (narrowing reportType to the
// LingoPure catalogue), NOT via z.infer — the consumer's zod and the package's
// zod can differ across the module boundary, which would collapse z.infer to
// `unknown`.
export type ReportSpec = Omit<CoreReportSpec, "reportType"> & { reportType: ReportType };

export const REPORT_CAPABILITIES: ReportCapability[] = [
  {
    key: "investment_memo",
    label: "Investment memo",
    defaultSections: ["Thesis", "Market", "Product", "Traction", "Team", "Financials", "Risks", "The ask"],
    draws: "the whole dataroom",
  },
  {
    key: "dd_summary",
    label: "Due-diligence summary (on a topic)",
    defaultSections: ["Findings", "Evidence", "Open questions"],
    draws: "topic-focused retrieval",
  },
  {
    key: "financials_brief",
    label: "Financials brief",
    defaultSections: ["Revenue model", "Unit economics", "Projections", "Cap table", "Use of funds"],
    draws: "financial docs + the model",
  },
  {
    key: "traction_summary",
    label: "Traction summary",
    defaultSections: ["Customers", "Contracts", "Reviews", "Pipeline"],
    draws: "contracts + GTM + reviews",
  },
  {
    key: "team_and_captable",
    label: "Team & cap table",
    defaultSections: ["Founders", "Advisors", "Cap table", "ESOP"],
    draws: "team + financial docs",
  },
  {
    key: "tech_defensibility",
    label: "Tech & defensibility",
    defaultSections: ["Architecture", "IP & moat", "LP-1000 telemetry", "Roadmap"],
    draws: "tech docs (incl. diagram captions)",
  },
  {
    key: "risk_register",
    label: "Risk register",
    defaultSections: ["Market risks", "Execution risks", "Financial risks", "Tech risks", "Legal/IP risks", "Mitigations"],
    draws: "the whole dataroom",
  },
  {
    key: "custom",
    label: "Custom report",
    defaultSections: ["Overview", "Detail", "Open questions"],
    draws: "your sections + topic",
  },
];

export function capabilityFor(type: ReportType): ReportCapability {
  return capabilityForCore(REPORT_CAPABILITIES, type);
}

// Typed against the package's (wide) ReportSpec so it satisfies ReportConfig.titleFor;
// callers passing the narrower LingoPure ReportSpec are still assignable.
export const defaultTitleFor: (spec: CoreReportSpec) => string = makeDefaultTitleFor(
  REPORT_CAPABILITIES,
  "LingoPure —"
);

/** Compact manifest the discovery agent reads to compose within the real report types. */
export function capabilityManifestForLLM(): string {
  return capabilityManifestForLLMCore(
    REPORT_CAPABILITIES,
    'Every section is synthesised ONLY from the dataroom; a section with no coverage is marked "Not covered in the available dataroom" (never faked).'
  );
}
