import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadInvestor, allowedTiersFor } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Documents · LingoPure Investor Dataroom",
};

const CATEGORY_LABELS: Record<string, string> = {
  financial: "Financials",
  legal: "Legal & contracts",
  tech: "Technology",
  gtm: "Go-to-market",
  market: "Market",
  team: "Team",
  cefr: "CEFR framework",
  reviews: "Customer reviews",
  other: "Other",
};

type DocRow = {
  id: string;
  display_name: string;
  category: string;
  confidentiality_tier: string;
  format: string;
};

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const investor = user ? await loadInvestor(user.id) : null;
  if (!investor) return null; // layout already gates; satisfies the type-checker

  const tiers = allowedTiersFor(investor.maxTier);
  const svc = createAdminClient();
  const { data } = await svc
    .from("dataroom_documents")
    .select("id, display_name, category, confidentiality_tier, format")
    .in("confidentiality_tier", tiers)
    .order("category")
    .order("display_name");
  const docs = (data ?? []) as DocRow[];

  const groups = new Map<string, DocRow[]>();
  for (const d of docs) {
    if (!groups.has(d.category)) groups.set(d.category, []);
    groups.get(d.category)!.push(d);
  }
  const cats = [...groups.keys()].sort((a, b) =>
    (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b)
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Documents</h1>
        <p className="max-w-prose text-base text-navy/70">
          Browse the dataroom files you have access to. Opening a document serves a{" "}
          <strong>watermarked, access-logged copy</strong> — each open is recorded against your
          account.{" "}
          {investor.maxTier === "main"
            ? "Deep-dive board materials are hidden until you accept the NDA."
            : "You have deep-dive access."}
        </p>
      </header>

      {docs.length === 0 ? (
        <p className="text-sm text-navy/60">No documents available.</p>
      ) : (
        cats.map((cat) => (
          <section key={cat} className="space-y-2">
            <h2 className="font-serif text-lg text-navy">{CATEGORY_LABELS[cat] ?? cat}</h2>
            <ul className="divide-y divide-cream rounded-2xl border border-cream bg-paper">
              {groups.get(cat)!.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-navy">{d.display_name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-navy/40">
                      {d.format}
                      {d.confidentiality_tier === "restricted" ? " · deep dive" : ""}
                    </p>
                  </div>
                  <a
                    href={`/api/investor/documents/${d.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-navy/20 px-4 text-sm text-navy hover:bg-mist"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
