// @explanatory-header-exempt — portal surface
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgIdentity, getOrgIdBySlug } from "@/lib/org/auth";

export default async function OrgBillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await getOrgIdBySlug(supabase, slug);
  if (!orgId) notFound();
  const identity = await getOrgIdentity(supabase, user, orgId);
  if (!identity) notFound();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("package, tier, status, price_monthly, currency, next_billing_at")
    .eq("organisation_id", orgId)
    .maybeSingle();

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Billing</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        Your organisation&apos;s subscription and billing status.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Subscription
          </p>
          {sub?.status === "active" ? (
            <>
              <p className="mt-1 font-serif text-2xl text-navy">
                {sub.package}
              </p>
              <p className="mt-1 text-sm text-mute">
                Tier: {sub.tier}
              </p>
              <p className="mt-1 text-sm text-mute">
                {sub.currency ?? "AUD"} {sub.price_monthly?.toLocaleString() ?? "—"}
                /month
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-mute">No active subscription</p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Status
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
              sub?.status === "active"
                ? "bg-teal/10 text-teal"
                : "bg-mist text-mute"
            }`}
          >
            {sub?.status ?? "unknown"}
          </span>
          {sub?.next_billing_at && (
            <p className="mt-3 text-sm text-mute">
              Next billing: {new Date(sub.next_billing_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}