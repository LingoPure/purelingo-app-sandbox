import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadInvestor } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_CAPABILITIES, capabilityFor, type ReportType } from "@/lib/investor/report-spec";
import { ReportsBuilder } from "./reports-builder";

export const metadata: Metadata = {
  title: "Reports · LingoPure Investor Dataroom",
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const investor = user ? await loadInvestor(user.id) : null;

  let mine: { id: string; report_type: string; created_at: string; storage_path: string | null }[] = [];
  if (investor) {
    const svc = createAdminClient();
    const { data } = await svc
      .from("dataroom_reports")
      .select("id, report_type, created_at, storage_path")
      .eq("investor_id", investor.id)
      .order("created_at", { ascending: false })
      .limit(20);
    mine = data ?? [];
  }

  const scope =
    investor?.maxTier === "restricted"
      ? "the full dataroom, including deep-dive materials"
      : "the main dataroom";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Generate a report</h1>
        <p className="max-w-prose text-base text-navy/70">
          Generate an investor report — an investment memo, financials brief,
          due-diligence summary and more — synthesised from {scope}. Describe what
          you need, or pick a type below; every section is drawn from the documents
          and cites its sources, and anything the dataroom doesn&apos;t cover is
          marked rather than invented. Reports export as a watermarked PDF.
        </p>
      </header>

      <ReportsBuilder
        capabilities={REPORT_CAPABILITIES.map((c) => ({
          key: c.key,
          label: c.label,
          defaultSections: c.defaultSections,
        }))}
      />

      <section className="space-y-2">
        <h2 className="font-serif text-lg text-navy">Your reports</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-navy/60">No reports yet.</p>
        ) : (
          <ul className="divide-y divide-cream rounded-2xl border border-cream bg-paper">
            {mine.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">
                    {capabilityFor(r.report_type as ReportType).label}
                  </p>
                  <p className="text-xs text-navy/50">
                    {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                </div>
                {r.storage_path ? (
                  <a
                    href={`/api/investor/reports/${r.id}/download`}
                    className="shrink-0 rounded-md border border-navy/20 px-3 py-2 text-sm text-navy hover:bg-mist"
                  >
                    Download PDF
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-navy/40">markdown only</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
