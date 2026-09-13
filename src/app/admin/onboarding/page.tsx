// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { loadOnboardingDirectory } from "@/lib/platform/directory";
import { PageHeading } from "../page-heading";
import { ONBOARDING_STEPS } from "@/lib/org/onboarding";
import { AddClientOrg } from "./add-client-org";

export default async function AdminOnboardingPage() {
  const supabase = await createClient();
  const rows = await loadOnboardingDirectory(supabase);

  return (
    <div>
      <PageHeading
        title="Onboarding"
        lead="Where every organisation sits in the wizard: package  departments  staff  teachers  baseline  curriculum  done. Baseline and curriculum steps run automatically once the manual steps complete."
      />

      <AddClientOrg />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {ONBOARDING_STEPS.map((step) => {
          const count = rows.filter((r) => r.step === step).length;
          return (
            <div key={step} className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                {step}
              </p>
              <p className="mt-1 font-serif text-2xl text-navy">{count}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 font-serif text-xl text-navy">Organisations by stage</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Organisation</Th>
              <Th>Stage</Th>
              <Th>Package</Th>
              <Th>Departments configured</Th>
              <Th>Staff allocated</Th>
              <Th>Teachers assigned</Th>
              <Th>Completed</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.organisation_id} className="hover:bg-mist/40">
                <Td className="font-medium text-ink">
                  {r.name}
                  <span className="block font-mono text-xs text-mute">/{r.slug}</span>
                </Td>
                <Td>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.step === "done"
                        ? "bg-teal/10 text-teal"
                        : "bg-amber/10 text-amber"
                    }`}
                  >
                    {r.step}
                  </span>
                </Td>
                <Td>{r.package ?? <span className="text-mute">—</span>}</Td>
                <DateTimeCell iso={r.departments_configured_at} />
                <DateTimeCell iso={r.staff_allocated_at} />
                <DateTimeCell iso={r.teachers_assigned_at} />
                <DateTimeCell iso={r.completed_at} />
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-mute">
                  No onboarding state yet — organisations start tracking once they begin the
                  wizard.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DateTimeCell({ iso }: { iso: string | null }) {
  return (
    <td className="px-4 py-3 font-mono text-xs">
      {iso ? new Date(iso).toLocaleDateString() : <span className="text-mute">—</span>}
    </td>
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