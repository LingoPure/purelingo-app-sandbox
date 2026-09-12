import { createClient } from "@/lib/supabase/server";
import { requireOrgRole } from "@/lib/org/auth";
import { loadOrgTeachers } from "@/lib/org/portal-data";
import { redirect } from "next/navigation";

export default async function OrgTeachersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (!org) redirect("/dashboard?error=org_not_found");

  const auth = await requireOrgRole(supabase, user, org.id);
  if ("status" in auth) redirect("/dashboard?error=unauthorized");

  const teachers = await loadOrgTeachers(supabase);

  return (
    <div>
      <h1 className="text-2xl font-bold">Teachers - {auth.identity.orgName}</h1>
      <pre className="mt-4 text-xs">{JSON.stringify(teachers, null, 2)}</pre>
    </div>
  );
}
