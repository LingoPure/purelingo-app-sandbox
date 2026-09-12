// @explanatory-header-exempt — wizard surface; the current-step header is the explanatory header
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgIdentity } from "@/lib/org/auth";
import { loadOnboarding } from "@/lib/org/service";
import { OrgOnboardingWizard } from "@/components/org/onboarding/wizard";

export const metadata = {
  title: "Onboarding — LingoPure",
};

export default async function OrgOnboardingPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?message=" + encodeURIComponent("Please sign in to continue."));
  }

  const identity = await getOrgIdentity(supabase, user, orgId);
  if (!identity) {
    notFound();
  }

  const bundle = await loadOnboarding(createAdminClient(), orgId);
  if (!bundle) {
    notFound();
  }

  // Wizard mutations require owner/hr. A read-only member sees a notice instead.
  const canMutate = identity.role === "owner" || identity.role === "hr";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-1 font-serif text-3xl text-navy">
        Onboarding · {identity.orgName}
      </h1>
      <p className="mb-8 text-sm text-mute">
        /{identity.orgSlug} · you are signed in as an organisation {identity.role}
        {canMutate ? "" : " (view-only)"}
      </p>

      {canMutate ? (
        <OrgOnboardingWizard orgId={orgId} initialBundle={bundle} />
      ) : (
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-sm text-mute">
            Only organisation owners and HR admins can run the onboarding wizard.
          </p>
        </div>
      )}
    </div>
  );
}