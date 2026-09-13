"use server";

import { headers } from "next/headers";
import { adminSupabase } from "@/lib/employer/data";
import { sendCandidateScreenEmail } from "@/lib/email/candidate-screen";

export type StartResult =
  | { ok: true; email: string }
  | { ok: false; error: string; reason?: "not_found" | "expired" | "used" };

async function appBaseUrl(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  const xfh = h.get("x-forwarded-host");
  const base = origin
    ? origin
    : xfh
      ? `https://${xfh}`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export async function startCandidateScreen(token: string): Promise<StartResult> {
  const supabase = adminSupabase();
  const { data: invite, error } = await supabase
    .from("candidate_invites")
    .select("id, candidate_email, candidate_name, status, expires_at, employer_id, role_id")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) return { ok: false, error: "This invitation link is not valid.", reason: "not_found" };

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired. Ask the recruiter to send a new one.", reason: "expired" };
  }
  if (invite.status === "completed") {
    return { ok: false, error: "You've already completed this screen. Thank you!", reason: "used" };
  }

  const email = (invite.candidate_email as string).toLowerCase();
  const base = await appBaseUrl();
  const redirectTo = `${base}/auth/callback?next=/screen/${token}/join`;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData.properties?.action_link) {
    return { ok: false, error: "Could not create your sign-in link. Please try again." };
  }

  await supabase.from("candidate_invites").update({ status: "started" }).eq("id", invite.id);

  const { data: employerRow } = await supabase
    .from("employers")
    .select("name")
    .eq("id", invite.employer_id)
    .maybeSingle();
  const company = (employerRow as { name?: string } | null)?.name ?? "the company";

  const { data: roleRow } = invite.role_id
    ? await supabase.from("roles").select("name").eq("id", invite.role_id).maybeSingle()
    : { data: null };
  const roleName = (roleRow as { name?: string } | null)?.name ?? null;

  const mail = await sendCandidateScreenEmail({
    to: email,
    name: (invite.candidate_name as string | null) ?? null,
    company,
    roleName,
    actionLink: linkData.properties.action_link,
  });

  if (!mail.ok) {
    await supabase.from("candidate_invites").update({ status: "invited" }).eq("id", invite.id);
    return { ok: false, error: mail.error ?? "Could not send your sign-in link." };
  }

  return { ok: true, email };
}