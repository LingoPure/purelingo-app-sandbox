import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Access log · Operator Console" };

const ACTIONS = ["ask", "answer", "report_generate", "download", "doc_view", "nda_accept", "invite", "status_change", "tier_change"];

type AuditRow = {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  investors: { email: string } | null;
};

function summarise(action: string, detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const d = detail as Record<string, string>;
  if (action === "ask" || action === "answer") return String(d.question ?? "");
  if (action === "doc_view") return String(d.display_name ?? "");
  if (action === "report_generate") return String(d.reportType ?? "");
  if (action === "download") return String(d.reportId ?? d.storage_path ?? "");
  if (action === "nda_accept") return `NDA ${d.nda_version ?? ""}`;
  if (action === "invite" || action === "tier_change") return `tier=${d.tier ?? ""} by ${d.by ?? ""}`;
  if (action === "status_change") return `${d.status ?? ""} by ${d.by ?? ""}`;
  return "";
}

export default async function AccessLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const svc = createAdminClient();
  let q = svc
    .from("dataroom_audit")
    .select("id, action, detail, created_at, investors(email)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (action) q = q.eq("action", action);
  const { data } = await q;
  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Access log</h1>
        <p className="max-w-prose text-base text-navy/70">
          Every confidential action recorded against an investor — questions asked,
          answers returned, documents opened, reports generated and downloaded, NDA
          acceptances, and grant changes. Newest first (last 300).
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/investor/admin/access-log"
          className={!action ? "rounded-full bg-navy px-3 py-1.5 text-xs text-paper" : "rounded-full border border-navy/20 px-3 py-1.5 text-xs text-navy hover:bg-mist"}
        >
          All
        </Link>
        {ACTIONS.map((a) => (
          <Link
            key={a}
            href={`/investor/admin/access-log?action=${a}`}
            className={action === a ? "rounded-full bg-navy px-3 py-1.5 text-xs text-paper" : "rounded-full border border-navy/20 px-3 py-1.5 text-xs text-navy hover:bg-mist"}
          >
            {a}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-cream bg-paper">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-mist text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-navy">When (UTC)</th>
              <th className="px-3 py-2 font-medium text-navy">Investor</th>
              <th className="px-3 py-2 font-medium text-navy">Action</th>
              <th className="px-3 py-2 font-medium text-navy">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-navy/50">No log entries.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-cream align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-navy/60">
                    {new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2 text-navy/80">{r.investors?.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-mist px-2 py-0.5 text-xs text-navy/80">{r.action}</span>
                  </td>
                  <td className="max-w-[420px] truncate px-3 py-2 text-navy/70" title={summarise(r.action, r.detail)}>
                    {summarise(r.action, r.detail)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
