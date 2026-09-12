// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { loadBillingDirectory } from "@/lib/platform/directory";
import { PageHeading } from "../page-heading";

export default async function AdminBillingPage() {
  const supabase = await createClient();
  const rows = await loadBillingDirectory(supabase);
  const { currency } = rows.find((r) => r.currency) ?? { currency: "AUD" };

  const active = rows.filter((r) => r.status === "active" && r.package);
  const monthly = active.reduce((sum, r) => sum + (r.price_monthly ?? 0), 0);

  return (
    <div>
      <PageHeading
        title="Billing"
        lead="Per-organisation subscriptions. This phase renders synthetic data — real Stripe billing (via @caistech/subscription-billing) lands in a later phase."
      />

      <div className="mb-6 rounded-xl border border-line bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">
          Active MRR ({currency})
        </p>
        <p className="mt-1 font-serif text-3xl text-navy">
          {monthly.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-mute">
          {active.length} active subscription{active.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatusCard label="Active" value={rows.filter((r) => r.status === "active").length} tone="teal" />
        <StatusCard label="Trialing" value={rows.filter((r) => r.status === "trialing").length} tone="amber" />
        <StatusCard label="Past due" value={rows.filter((r) => r.status === "past_due").length} tone="coral" />
        <StatusCard label="Cancelled" value={rows.filter((r) => r.status === "cancelled").length} tone="mute" />
      </div>

      <h2 className="mb-3 mt-8 font-serif text-xl text-navy">Subscriptions</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Organisation</Th>
              <Th>Package</Th>
              <Th>Tier</Th>
              <Th>Status</Th>
              <Th>Monthly</Th>
              <Th>Next billing</Th>
              <Th>Onboarded</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.organisation_id} className="hover:bg-mist/40">
                <Td className="font-medium text-ink">{r.name}</Td>
                <Td>{r.package ?? <span className="text-mute">—</span>}</Td>
                <Td className="capitalize">{r.tier ?? <span className="text-mute">—</span>}</Td>
                <Td>
                  <StatusPill status={r.status} />
                </Td>
                <Td className="font-mono text-xs">
                  {r.price_monthly != null
                    ? `${r.currency ?? "AUD"} ${r.price_monthly.toLocaleString()}`
                    : <span className="text-mute">—</span>}
                </Td>
                <Td className="font-mono text-xs">
                  {r.next_billing_at
                    ? new Date(r.next_billing_at).toLocaleDateString()
                    : <span className="text-mute">—</span>}
                </Td>
                <Td>
                  {r.onboarding_done ? (
                    <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                      done
                    </span>
                  ) : (
                    <span className="text-mute">—</span>
                  )}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-mute">
                  No subscriptions yet — run `npm run billing:seed-subscriptions` after
                  migrations to populate synthetic rows.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "amber" | "coral" | "mute";
}) {
  const tones: Record<string, string> = {
    teal: "text-teal",
    amber: "text-amber",
    coral: "text-coral",
    mute: "text-mute",
  };
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className={`mt-1 font-serif text-2xl ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const tone =
    status === "active"
      ? "bg-teal/10 text-teal"
      : status === "trialing"
        ? "bg-amber/10 text-amber"
        : status === "past_due"
          ? "bg-coral/10 text-coral"
          : "bg-mist text-mute";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {status ?? <span className="text-mute">—</span>}
    </span>
  );
}