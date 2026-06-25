import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { capabilityFor, type ReportType } from "@/lib/investor/report-spec";

export const metadata: Metadata = { title: "Reports · Operator Console" };

type ReportRow = {
  id: string;
  report_type: string;
  created_at: string;
  storage_path: string | null;
  investors: { email: string } | null;
};

export default async function AdminReportsPage() {
  const svc = createAdminClient();
  const { data } = await svc
    .from("dataroom_reports")
    .select("id, report_type, created_at, storage_path, investors(email)")
    .order("created_at", { ascending: false })
    .limit(200);
  const reports = (data ?? []) as unknown as ReportRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Reports</h1>
        <p className="max-w-prose text-base text-navy/70">
          Every report investors have generated from the dataroom ({reports.length}).
          Each is also captured in the access log; PDFs are stored watermarked per
          investor in the private bucket.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-cream bg-paper">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-mist text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-navy">When (UTC)</th>
              <th className="px-3 py-2 font-medium text-navy">Investor</th>
              <th className="px-3 py-2 font-medium text-navy">Report</th>
              <th className="px-3 py-2 font-medium text-navy">Format</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-navy/50">No reports generated yet.</td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="border-t border-cream align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-navy/60">
                    {new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2 text-navy/80">{r.investors?.email ?? "—"}</td>
                  <td className="px-3 py-2 text-navy">{capabilityFor(r.report_type as ReportType).label}</td>
                  <td className="px-3 py-2 text-xs text-navy/60">{r.storage_path ? "PDF" : "markdown"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
