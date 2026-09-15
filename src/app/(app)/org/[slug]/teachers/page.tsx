// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { requireOrgRole, type OrgRole } from "@/lib/org/auth";
import { loadOrgTeachers } from "@/lib/org/portal-data";
import { redirect } from "next/navigation";

const TEACHER_ROLES: OrgRole[] = ["owner", "hr", "teacher"];

export default async function OrgTeachersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=" + encodeURIComponent(`/org/${slug}/teachers`));

  const { data: org } = await supabase.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (!org) redirect("/dashboard?error=org_not_found");

  const auth = await requireOrgRole(supabase, user, org.id, TEACHER_ROLES);
  if ("status" in auth) redirect("/dashboard?error=unauthorized");

  const teachers = await loadOrgTeachers(supabase);

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Teachers</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        The teaching staff of LingoPure available to {auth.identity.orgName} — who they
        are, their employment type and how many students they currently teach.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Teacher</Th>
              <Th>Email</Th>
              <Th>Employment</Th>
              <Th>Current students</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teachers.map((t) => (
              <tr key={t.id} className="hover:bg-mist/40">
                <Td className="font-medium text-ink">{t.full_name}</Td>
                <Td className="text-mute">{t.email}</Td>
                <Td>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
                    {t.employment_type}
                  </span>
                </Td>
                <Td>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-navy">
                    {t.assignments}
                  </span>
                </Td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td className="py-8 text-center text-mute">
                  No active teachers yet.
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