// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { requireOrgRole, type OrgRole } from "@/lib/org/auth";
import { loadOrgStaff } from "@/lib/org/portal-data";
import { redirect } from "next/navigation";

const STAFF_ROLES: OrgRole[] = ["owner", "hr", "teacher"];

export default async function OrgStaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=" + encodeURIComponent(`/org/${slug}/staff`));

  const { data: org } = await supabase.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (!org) redirect("/dashboard?error=org_not_found");

  const auth = await requireOrgRole(supabase, user, org.id, STAFF_ROLES);
  if ("status" in auth) redirect("/dashboard?error=unauthorized");

  const staff = await loadOrgStaff(supabase, org.id);

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Staff</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        Everyone with a seat in {auth.identity.orgName} — their role, department and
        membership status. Staff and student seats cannot edit these lists; owners and
        HR manage them.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Department</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {staff.map((m) => (
              <tr key={m.membership_id} className="hover:bg-mist/40">
                <Td className="font-medium text-ink">{m.email ?? "Unlinked user"}</Td>
                <Td>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
                    {m.role}
                  </span>
                </Td>
                <Td className="text-mute">{m.department_name ?? "—"}</Td>
                <Td>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      m.status === "active"
                        ? "bg-teal/10 text-teal"
                        : "bg-amber/10 text-amber"
                    }`}
                  >
                    {m.status}
                  </span>
                </Td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td className="py-8 text-center text-mute">
                  No staff yet — invite the first owners and HR from Settings.
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