/**
 * Report executor — thin adapter over @caistech/dataroom-core. The per-section
 * parallel synthesis + markdown/citation assembly live in the engine; LingoPure
 * supplies the LLM, retriever, section prompt, and title strategy via ./dataroom.
 * Signature preserved for the run route.
 */

import { dataroom } from "@/lib/investor/dataroom";
import type { ReportSpec } from "@/lib/investor/report-spec";
import type { Tier } from "@/lib/investor/auth";
import type { BuiltReport, BuiltSection } from "@caistech/dataroom-core";

export type { BuiltReport, BuiltSection };

export function buildReport(
  spec: ReportSpec,
  allowedTiers: Tier[]
): Promise<BuiltReport> {
  return dataroom.buildReport(spec, allowedTiers);
}
