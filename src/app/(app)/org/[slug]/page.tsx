// @explanatory-header-exempt — portal home; the page heading is the explanatory header
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgIdentity, getOrgIdBySlug } from "@/lib/org/auth";
import { loadOrgDashboard } from "@/lib/org/portal-data";

const NAV_LINKS = [
  { label: "Departments", suffix: "departments" },
  { label: "Staff", suffix: "staff" },
  { label: "Students", suffix: "students" },
  { label: "Teachers", suffix: "teachers" },
  { label: "Billing", suffix: "billing" },
];

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await getOrgIdBySlug(supabase, slug);
  if (!orgId) notFound();
  const identity = await getOrgIdentity(supabase, user, orgId);
  if (!identity) notFound();

  const data = await loadOrgDashboard(supabase, orgId);
  if (!data) notFound();

  const links = identity.isOwnerOrHr
    ? [...NAV_LINKS, { label: "Settings", suffix: "settings" }]
    : NAV_LINKS;

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">{data.org.name}</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        Overview of your organisation: members, departments, subscriptions and
        onboarding progress.
      </p>

      <div className="mb-8 mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Members" value={data.stats.members} />
        <StatCard label="Departments" value={data.stats.departments} />
        <StatCard label="Students" value={data.stats.students} />
        <StatCard label="Teachers" value={data.stats.teachers} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Subscription
          </p>
          {data.subscription?.status === "active" ? (
            <>
              <p className="mt-1 font-serif text-2xl text-navy">
                {data.subscription.package}
              </p>
              <p className="mt-1 text-sm text-mute">
                {data.subscription.tier} · {data.subscription.currency ?? "AUD"}{" "}
                {data.subscription.price_monthly?.toLocaleString() ?? "—"}
                /month
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-mute">No active subscription</p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Onboarding
          </p>
          {data.onboarding?.completed_at ? (
            <>
              <span className="mt-1 inline-block rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                Done
              </span>
              <p className="mt-2 text-sm text-mute">
                Completed {new Date(data.onboarding.completed_at).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-mute">
              Stage: {data.onboarding?.step ?? "not started"}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-10 font-serif text-xl text-navy">Quick links</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((link) => (
          <Link
            key={link.suffix}
            href={`/org/${slug}/${link.suffix}`}
            className="rounded-xl border border-line bg-white px-4 py-3 text-center text-sm font-medium text-navy hover:border-teal/50 hover:bg-mist"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl text-navy">{value}</p>
    </div>
  );
}