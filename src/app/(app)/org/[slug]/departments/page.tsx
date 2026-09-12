// @explanatory-header-exempt — portal surface
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgIdentity, getOrgIdBySlug } from "@/lib/org/auth";

export default async function OrgDepartmentsPage({
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

  const { data: departments } = await supabase
    .from("organisation_departments")
    .select("id, name, is_archived")
    .eq("organisation_id", orgId)
    .order("name");

  const active = (departments ?? []).filter((d) => !d.is_archived);
  const archived = (departments ?? []).filter((d) => d.is_archived);

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Departments</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        Active departments configured for this organisation.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((d) => (
          <div key={d.id} className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="text-sm font-medium text-ink">{d.name}</p>
          </div>
        ))}
        {active.length === 0 && (
          <p className="text-sm text-mute">
            No departments yet — configure them in the onboarding wizard.
          </p>
        )}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-serif text-lg text-navy">Archived</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-line bg-mist px-4 py-3 text-mute"
              >
                <p className="text-sm">{d.name}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}