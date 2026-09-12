import { createClient } from "@/lib/supabase/server";
import { requireOrgRole } from "@/lib/org/auth";
import { loadOrgStudents } from "@/lib/org/portal-data";
import { redirect } from "next/navigation";

export default async function OrgStudentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (!org) redirect("/dashboard?error=org_not_found");

  const auth = await requireOrgRole(supabase, user, org.id);
  if ("status" in auth) redirect("/dashboard?error=unauthorized");

  const students = await loadOrgStudents(supabase, org.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">Students - {auth.identity.orgName}</h1>
      <pre className="mt-4 text-xs">{JSON.stringify(students, null, 2)}</pre>
    </div>
  );
}
