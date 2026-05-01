/**
 * Magic-link invite issuance for staff already in auth.users.
 *
 * Bulk-imported staff (created via auth.admin.createUser with
 * email_confirm:true) skip the "invite" path entirely — they're already
 * confirmed users. To get them into onboarding we issue a one-shot
 * magiclink and email it via Resend.
 *
 * Shared by:
 *   /api/employer/staff/invite          — single existing-user form path
 *   /api/employer/staff/invite-existing — bulk roster path
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendInviteEmail } from "@/lib/email/invite";

export type IssuedInvite = {
  actionLink: string;
  emailDelivery: "sent" | "skipped" | "failed";
  emailError: string | null;
  mailWarning: string | null;
};

export type IssueInviteResult =
  | ({ ok: true } & IssuedInvite)
  | { ok: false; error: string };

export async function issueExistingUserMagicLink(input: {
  supabase: SupabaseClient;
  email: string;
  inviteeName: string;
  employerName: string | null;
  origin: string;
}): Promise<IssueInviteResult> {
  const { supabase, email, inviteeName, employerName, origin } = input;
  const redirectTo = `${origin}/auth/callback?next=/onboarding`;

  const linkRes = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (linkRes.error || !linkRes.data.properties?.hashed_token) {
    return {
      ok: false,
      error: `Magic link generation failed: ${
        linkRes.error?.message ?? "missing hashed_token"
      }`,
    };
  }

  const tokenHash = linkRes.data.properties.hashed_token;
  const actionLink = `${origin}/auth/callback?token_hash=${encodeURIComponent(
    tokenHash
  )}&type=magiclink&next=${encodeURIComponent("/onboarding")}`;

  const send = await sendInviteEmail({
    to: email,
    inviteeName,
    employerName,
    actionLink,
    kind: "magiclink",
  });

  if (send.ok) {
    return {
      ok: true,
      actionLink,
      emailDelivery: "sent",
      emailError: null,
      mailWarning: null,
    };
  }
  if (send.error === "RESEND_API_KEY not configured") {
    return {
      ok: true,
      actionLink,
      emailDelivery: "skipped",
      emailError: send.error,
      mailWarning:
        "RESEND_API_KEY not set on this deployment — paste the link manually.",
    };
  }
  return {
    ok: true,
    actionLink,
    emailDelivery: "failed",
    emailError: send.error ?? "Resend send failed",
    mailWarning: `Email send failed (${send.error}) — paste the link manually.`,
  };
}
