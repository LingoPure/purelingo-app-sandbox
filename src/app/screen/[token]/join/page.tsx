import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/employer/data";

export const dynamic = "force-dynamic";

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/**
 * Bucket: /screen/[token]/join  (arrives after the magic-link callback with
 * next=/screen/{token}/join). The auth user already exists (students row
 * auto-created on auth). We stamp the student row with the employer + target
 * role so the standard onboarding/assessment picks up the hiring context, then
 * hand off to /onboarding.
 */
export default async function ScreenJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/screen/${token}`);
  }
  const userEmail = user.email.toLowerCase();

  const admin = adminSupabase();
  const { data: invite } = await admin
    .from("candidate_invites")
    .select("candidate_email, candidate_name, status, expires_at, employer_id, role_id, id")
    .eq("token", token)
    .maybeSingle();

  if (!invite || isExpired(invite.expires_at)) {
    redirect("/screen/expired");
  }
  if ((invite.candidate_email as string).toLowerCase() !== userEmail) {
    redirect(`/screen/${token}`);
  }

  const { error: studentError } = await admin
    .from("students")
    .update({
      employer_id: invite.employer_id,
      role_id: invite.role_id ?? null,
      name: (invite.candidate_name as string | null) ?? user.email?.split("@")[0] ?? null,
      email: user.email,
    })
    .eq("id", user.id);

  if (!studentError) {
    await admin
      .from("candidate_invites")
      .update({
        student_id: user.id,
        status: invite.status === "invited" ? "started" : invite.status,
      })
      .eq("id", invite.id as string);
  }

  redirect("/onboarding");
}