// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { loadContentDirectory } from "@/lib/platform/directory";
import { PageHeading } from "../page-heading";
import { SERVICE_PACKAGES, PACKAGE_DEPARTMENTS } from "@/lib/org/onboarding";

export default async function AdminContentPage() {
  const supabase = await createClient();
  const banks = await loadContentDirectory(supabase);

  return (
    <div>
      <PageHeading
        title="Content"
        lead="The assessment content in play and the service packages every organisation can subscribe to. Question bank versions are read live from assessment sessions."
      />

      <h2 className="mb-3 font-serif text-xl text-navy">Question banks in use</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Version</Th>
              <Th>Assessments run</Th>
              <Th>Languages</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {banks.map((b) => (
              <tr key={b.question_bank_version} className="hover:bg-mist/40">
                <td className="px-4 py-3 font-mono text-xs text-ink">
                  {b.question_bank_version}
                </td>
                <td className="px-4 py-3">{b.assessments_run}</td>
                <td className="px-4 py-3 font-mono text-xs text-mute">
                  {b.languages.join(", ") || <span className="text-mute">—</span>}
                </td>
              </tr>
            ))}
            {banks.length === 0 && (
              <tr>
                <td className="py-8 text-center text-mute">
                  No assessment sessions recorded yet — question banks appear here once the
                  2K pipeline runs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-10 font-serif text-xl text-navy">Service packages</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {SERVICE_PACKAGES.map((pkg) => (
          <div key={pkg} className="rounded-xl border border-line bg-white p-5">
            <p className="font-serif text-lg text-navy">{pkg}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-mute">
              Departments
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {PACKAGE_DEPARTMENTS[pkg].map((d) => (
                <li
                  key={d}
                  className="rounded-full bg-mist px-2.5 py-1 text-xs text-ink"
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ))}
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