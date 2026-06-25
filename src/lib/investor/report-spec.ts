// The investor ReportSpec (Zod) + capability manifest — the single contract the
// discovery agent (Morgan), the building-block form, and the executor all share.
// Ported from F2K's reports/query-spec.ts pattern, but LingoPure reports are
// NARRATIVE-over-RAG (sections synthesised from the dataroom), not SQL queries.
//
// Tier is NOT part of the spec — the run route derives allowed tiers from the
// investor's server-side max_tier (the NDA gate), so a client can never widen scope.

import { z } from "zod";

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

export const ReportSpecSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  title: z.string().min(2).max(200).nullable().default(null),
  /** Free-text focus for dd_summary / custom (e.g. "the DatumHQ contract"). */
  topic: z.string().max(300).nullable().default(null),
  sections: z.array(z.string().min(2).max(140)).min(1).max(12),
  format: z.enum(["pdf", "markdown"]).default("pdf"),
});
export type ReportSpec = z.infer<typeof ReportSpecSchema>;

export interface ReportCapability {
  key: ReportType;
  label: string;
  defaultSections: string[];
  draws: string;
}

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
  return REPORT_CAPABILITIES.find((c) => c.key === type) ?? REPORT_CAPABILITIES[0];
}

export function defaultTitleFor(spec: ReportSpec): string {
  if (spec.title) return spec.title;
  const cap = capabilityFor(spec.reportType);
  const base = `LingoPure — ${cap.label}`;
  return spec.topic ? `${base}: ${spec.topic}` : base;
}

/** Compact manifest the discovery agent reads to compose within the real report types. */
export function capabilityManifestForLLM(): string {
  const lines = ["REPORT TYPES (compose within these; default sections shown, editable):"];
  for (const c of REPORT_CAPABILITIES) {
    lines.push(`- ${c.key}: ${c.label} — sections: ${c.defaultSections.join(" / ")} — draws on ${c.draws}.`);
  }
  lines.push(
    "Every section is synthesised ONLY from the dataroom; a section with no coverage is marked \"Not covered in the available dataroom\" (never faked)."
  );
  return lines.join("\n");
}
