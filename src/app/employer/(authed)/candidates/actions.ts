"use server";

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { sendCandidateScreenEmail } from "@/lib/email/candidate-screen";

export type InviteResult = { ok: true; email: string } | { ok: false; error: string };

const INVITE_TTL_DAYS = 14;

export async function inviteCandidate(input: {
  name: string;
  email: string;
  roleId?: string;
}): Promise<InviteResult> {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) {
    return { ok: false, error: "Not authorised" };
  }
  const employerId = auth.admin.employerId;
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  const name = input.name.trim();

  const supabase = adminSupabase();
  const roleId = input.roleId && /^[0-9a-f-]{36}$/i.test(input.roleId) ? input.roleId : null;

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();

  const { data: invite, error: insertError } = await supabase
    .from("candidate_invites")
    .insert({
      employer_id: employerId,
      role_id: roleId,
      candidate_email: email,
      candidate_name: name || null,
      token,
      status: "invited",
      expires_at: expiresAt,
    })
    .select("id, token")
    .single();

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { data: employerRow } = await supabase
    .from("employers")
    .select("name")
    .eq("id", employerId)
    .maybeSingle();
  const company = (employerRow as { name?: string } | null)?.name ?? "your organisation";

  const roleName = roleId
    ? await loadRoleName(supabase, roleId)
    : null;

  const origin = process.env.APP_URL ?? "https://purelingo-app-sandbox.vercel.app";
  const actionLink = `${origin}/screen/${token}`;

  const mailResult = await sendCandidateScreenEmail({
    to: email,
    name: name || null,
    company,
    roleName,
    actionLink,
  });

  if (!mailResult.ok) {
    await supabase.from("candidate_invites").update({ status: "expired" }).eq("id", invite.id);
    return { ok: false, error: mailResult.error ?? "Email send failed" };
  }

  return { ok: true, email };
}

async function loadRoleName(supabase: ReturnType<typeof adminSupabase>, roleId: string): Promise<string | null> {
  const { data } = await supabase.from("roles").select("name").eq("id", roleId).maybeSingle();
  return ((data as { name?: string } | null)?.name) ?? null;
}