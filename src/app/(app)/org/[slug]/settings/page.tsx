// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { requireOrgRole, type OrgRole } from "@/lib/org/auth";
import { loadOrgSettings } from "@/lib/org/portal-data";
import { redirect } from "next/navigation";

const SETTINGS_ROLES: OrgRole[] = ["owner", "hr"];

export default async function OrgSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=" + encodeURIComponent(`/org/${slug}/settings`));

  const { data: org } = await supabase.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (!org) redirect("/dashboard?error=org_not_found");

  const auth = await requireOrgRole(supabase, user, org.id, SETTINGS_ROLES);
  if ("status" in auth) redirect("/dashboard?error=unauthorized");

  const settings = await loadOrgSettings(supabase, org.id);
  if (!settings) redirect("/dashboard?error=org_not_found");

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Settings</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        Organisation identity, who the owners and HR admins are, and the active
        subscription. Owners and HR see and manage everything here.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Organisation
          </p>
          <p className="mt-2 font-serif text-2xl text-navy">{settings.org.name}</p>
          <p className="mt-1 font-mono text-xs text-mute">/{settings.org.slug}</p>
          {settings.org.created_at && (
            <p className="mt-3 text-sm text-mute">
              Member since {new Date(settings.org.created_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Subscription
          </p>
          {settings.subscription?.status === "active" ? (
            <>
              <p className="mt-2 font-serif text-2xl text-navy">
                {settings.subscription.package}
              </p>
              <p className="mt-1 text-sm text-mute">
                {settings.subscription.tier}
                {settings.subscription.price_monthly
                  ? ` · ${settings.subscription.currency ?? "AUD"} ${settings.subscription.price_monthly.toLocaleString()}/month`
                  : ""}
              </p>
              {settings.subscription.next_billing_at && (
                <p className="mt-1 text-sm text-mute">
                  Next billing{" "}
                  {new Date(settings.subscription.next_billing_at).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-mute">No active subscription.</p>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-serif text-xl text-navy">Owners &amp; HR admins</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {settings.admins.map((a) => (
              <tr key={a.membership_id} className="hover:bg-mist/40">
                <Td className="font-medium text-ink">{a.email ?? "Unlinked user"}</Td>
                <Td>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
                    {a.role}
                  </span>
                </Td>
                <Td>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      a.status === "active" ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"
                    }`}
                  >
                    {a.status}
                  </span>
                </Td>
              </tr>
            ))}
            {settings.admins.length === 0 && (
              <tr>
                <td className="py-8 text-center text-mute">
                  No owners or HR admins yet — invite them from the onboarding wizard.
                </td>
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

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}