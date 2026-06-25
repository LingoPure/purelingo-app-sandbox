import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvestorsManager, type InvestorRow } from "./investors-client";

export const metadata: Metadata = {
  title: "Investors · Operator Console",
};

export default async function AdminInvestorsPage() {
  const svc = createAdminClient();
  const { data } = await svc
    .from("investors")
    .select("id, email, full_name, firm, max_tier, deep_dive_invited, status, nda_accepted_at, created_at")
    .order("created_at", { ascending: false });
  const investors = (data ?? []) as InvestorRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Investors</h1>
        <p className="max-w-prose text-base text-navy/70">
          Invite investors, grant or revoke deep-dive access, and revoke accounts.
          Inviting creates the account and returns a one-time sign-in link to send
          them. Revoking immediately blocks an investor from the dataroom.
        </p>
      </header>
      <InvestorsManager investors={investors} />
    </div>
  );
}
