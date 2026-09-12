// @explanatory-header-exempt — portal home; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import {
  loadBillingDirectory,
  loadOnboardingDirectory,
  loadOrgDirectory,
} from "@/lib/platform/directory";
import { PageHeading } from "./page-heading";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const [orgs, billing, onboarding] = await Promise.all([
    loadOrgDirectory(supabase),
    loadBillingDirectory(supabase),
    loadOnboardingDirectory(supabase),
  ]);

  const sold = billing.filter((b) => b.package && b.status === "active").length;
  const done = onboarding.filter((o) => o.step === "done").length;
  const learners = orgs.reduce((sum, o) => sum + o.members_active, 0);

  const cards = [
    { label: "Organisations", value: orgs.length },
    { label: "Active subscriptions", value: sold },
    { label: "Onboarded orgs", value: done },
    { label: "Active members", value: learners },
  ];

  return (
    <div>
      <PageHeading
        title="Platform overview"
        lead="Every organisation, its subscription and its onboarding progress — platform admins see the whole book of business."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">
              {c.label}
            </p>
            <p className="mt-1 font-serif text-3xl text-navy">{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-serif text-xl text-navy">Organisations</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Organisation</Th>
              <Th>Slug</Th>
              <Th>Active members</Th>
              <Th>Subscription</Th>
              <Th>Onboarding</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orgs.map((o) => {
              const sub = billing.find((b) => b.organisation_id === o.organisation_id);
              const onb = onboarding.find((n) => n.organisation_id === o.organisation_id);
              return (
                <tr key={o.organisation_id} className="hover:bg-mist/40">
                  <Td className="font-medium text-ink">{o.name}</Td>
                  <Td className="font-mono text-xs text-mute">/{o.slug}</Td>
                  <Td>{o.members_active}</Td>
                  <Td>
                    {sub?.status === "active" && sub.package ? (
                      <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                        {sub.package}
                      </span>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        onb?.step === "done"
                          ? "bg-teal/10 text-teal"
                          : onb?.step
                            ? "bg-amber/10 text-amber"
                            : "bg-mist text-mute"
                      }`}
                    >
                      {onb?.step ?? "not started"}
                    </span>
                  </Td>
                </tr>
              );
            })}
            {orgs.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-mute">
                  No organisations yet — create one from the org onboarding flow.
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