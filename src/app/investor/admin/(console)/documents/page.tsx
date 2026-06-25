import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Documents · Operator Console" };

type DocRow = {
  id: string;
  display_name: string;
  category: string;
  confidentiality_tier: string;
  format: string;
  ingested_at: string | null;
};

export default async function AdminDocumentsPage() {
  const svc = createAdminClient();
  const { data } = await svc
    .from("dataroom_documents")
    .select("id, display_name, category, confidentiality_tier, format, ingested_at")
    .order("confidentiality_tier")
    .order("category")
    .order("display_name");
  const docs = (data ?? []) as DocRow[];
  const main = docs.filter((d) => d.confidentiality_tier === "main").length;
  const restricted = docs.filter((d) => d.confidentiality_tier === "restricted").length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Documents</h1>
        <p className="max-w-prose text-base text-navy/70">
          The ingested dataroom corpus across both tiers. {docs.length} documents
          ({main} main · {restricted} deep-dive). Re-ingest or add files via{" "}
          <code className="rounded bg-mist px-1 py-0.5 text-sm">scripts/ingest-dataroom.mjs</code>{" "}
          (idempotent); new files appear here automatically.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-cream bg-paper">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-mist text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-navy">Document</th>
              <th className="px-3 py-2 font-medium text-navy">Category</th>
              <th className="px-3 py-2 font-medium text-navy">Tier</th>
              <th className="px-3 py-2 font-medium text-navy">Format</th>
              <th className="px-3 py-2 font-medium text-navy">Ingested</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-t border-cream align-top">
                <td className="max-w-[380px] truncate px-3 py-2 text-navy" title={d.display_name}>{d.display_name}</td>
                <td className="px-3 py-2 text-navy/70">{d.category}</td>
                <td className="px-3 py-2">
                  <span className={d.confidentiality_tier === "restricted" ? "rounded bg-gold/15 px-2 py-0.5 text-xs text-navy" : "rounded bg-mist px-2 py-0.5 text-xs text-navy/70"}>
                    {d.confidentiality_tier === "restricted" ? "deep dive" : "main"}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs uppercase text-navy/60">{d.format}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-navy/50">
                  {d.ingested_at ? new Date(d.ingested_at).toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
