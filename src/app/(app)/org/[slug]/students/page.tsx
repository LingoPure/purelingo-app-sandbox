// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { requireOrgRole, type OrgRole } from "@/lib/org/auth";
import { loadOrgStudents } from "@/lib/org/portal-data";
import { redirect } from "next/navigation";

const STUDENT_ROLES: OrgRole[] = ["owner", "hr", "teacher"];

export default async function OrgStudentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=" + encodeURIComponent(`/org/${slug}/students`));

  const { data: org } = await supabase.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (!org) redirect("/dashboard?error=org_not_found");

  const auth = await requireOrgRole(supabase, user, org.id, STUDENT_ROLES);
  if ("status" in auth) redirect("/dashboard?error=unauthorized");

  const students = await loadOrgStudents(supabase, org.id);

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Students</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        Learners under {auth.identity.orgName}&apos;s employers — their target level and
        how many assessments they have run. Teachers see this list read-only.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Target level</Th>
              <Th>Assessments</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-mist/40">
                <Td className="font-medium text-ink">{s.name}</Td>
                <Td className="text-mute">{s.email ?? "—"}</Td>
                <Td className="text-mute">{s.target_level ?? "Not set"}</Td>
                <Td>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
                    {s.assessments}
                  </span>
                </Td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td className="py-8 text-center text-mute">
                  No learners yet — they appear once the first assessments run.
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