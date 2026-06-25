"use server";

import { revalidatePath } from "next/cache";
import { getOperator } from "@/lib/investor/operator-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvestorInviteEmail } from "@/lib/email/invite";

export type InvestorRecord = {
  id: string;
  email: string;
  full_name: string | null;
  firm: string | null;
  max_tier: "main" | "restricted";
  deep_dive_invited: boolean;
  status: "active" | "revoked";
  nda_accepted_at: string | null;
  created_at: string;
};

export type ActionResult = {
  ok?: boolean;
  error?: string;
  inviteLink?: string;
  emailed?: boolean;
  rows?: InvestorRecord[];
};

/** Fresh investor list so a mutating action can hand the UI updated state directly. */
async function currentInvestors(
  svc: ReturnType<typeof createAdminClient>
): Promise<InvestorRecord[]> {
  const { data } = await svc
    .from("investors")
    .select("id, email, full_name, firm, max_tier, deep_dive_invited, status, nda_accepted_at, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as InvestorRecord[];
}

async function findUserId(svc: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Invite (or re-grant) an investor. Operator-gated. Returns a magic sign-in link to send. */
export async function inviteInvestor(formData: FormData): Promise<ActionResult> {
  const op = await getOperator();
  if (!op) return { error: "Not authorised." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim() || null;
  const firm = String(formData.get("firm") ?? "").trim() || null;
  // Admin chooses the ENTITLEMENT, not the access tier. Deep-dive-invited
  // investors still must accept the online NDA to actually reach deep dive —
  // so we always start them at max_tier 'main'.
  const deepDive = String(formData.get("access") ?? "main") === "deepdive";
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };

  const svc = createAdminClient();
  let userId: string;
  try {
    const created = await svc.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) {
      if (/registered|exists/i.test(created.error.message)) {
        const id = await findUserId(svc, email);
        if (!id) return { error: "User exists but could not be located." };
        userId = id;
      } else {
        return { error: created.error.message };
      }
    } else {
      userId = created.data.user.id;
    }

    const up = await svc.from("investors").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        firm,
        max_tier: "main",
        deep_dive_invited: deepDive,
        status: "active",
        invited_by: op.email,
      },
      { onConflict: "id" }
    );
    if (up.error) return { error: up.error.message };

    await svc
      .from("dataroom_audit")
      .insert({ investor_id: userId, action: "invite", detail: { by: op.email, deep_dive_invited: deepDive } })
      .then(() => {}, () => {});

    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://lingo-pure-ai.vercel.app";
    const link = await svc.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/callback?next=/investor/ask` },
    });
    // Canonical: send the link to OUR callback with token_hash (server-side
    // verifyOtp), NOT Supabase's /auth/v1/verify action_link — that returns the
    // session in a URL hash the server callback can't read ("Missing
    // verification code"). hashed_token + token_hash is cross-device safe.
    const hashedToken = link.data?.properties?.hashed_token;
    const actionLink = hashedToken
      ? `${origin}/auth/callback?token_hash=${hashedToken}&type=magiclink&next=${encodeURIComponent("/investor/ask")}`
      : link.data?.properties?.action_link;

    // Auto-send via Resend (canonical flow). Best-effort — on failure we still
    // return the link so the operator can send it manually.
    let emailed = false;
    if (actionLink) {
      const sent = await sendInvestorInviteEmail({
        to: email,
        inviteeName: fullName || firm || email,
        firm,
        actionLink,
        deepDive,
      });
      emailed = sent.ok;
    }

    revalidatePath("/investor/admin/investors");
    return {
      ok: true,
      emailed,
      inviteLink: emailed ? undefined : actionLink,
      rows: await currentInvestors(svc),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invite failed." };
  }
}

/** Revoke or reactivate an investor's access. */
export async function setInvestorStatus(
  investorId: string,
  status: "active" | "revoked"
): Promise<ActionResult> {
  const op = await getOperator();
  if (!op) return { error: "Not authorised." };
  const svc = createAdminClient();
  const { error } = await svc.from("investors").update({ status }).eq("id", investorId);
  if (error) return { error: error.message };
  await svc
    .from("dataroom_audit")
    .insert({ investor_id: investorId, action: "status_change", detail: { by: op.email, status } })
    .then(() => {}, () => {});
  revalidatePath("/investor/admin/investors");
  return { ok: true, rows: await currentInvestors(svc) };
}

/**
 * Toggle deep-dive ELIGIBILITY (entitlement) — NOT access. Granting eligibility
 * lets the investor unlock deep dive by accepting the online NDA; it does not
 * itself reveal any deep-dive content. Removing eligibility also pulls any actual
 * deep-dive access (max_tier back to main). The admin can never bypass the NDA.
 */
export async function setDeepDiveEligibility(
  investorId: string,
  eligible: boolean
): Promise<ActionResult> {
  const op = await getOperator();
  if (!op) return { error: "Not authorised." };
  const svc = createAdminClient();
  const patch = eligible
    ? { deep_dive_invited: true }
    : { deep_dive_invited: false, max_tier: "main" as const };
  const { error } = await svc.from("investors").update(patch).eq("id", investorId);
  if (error) return { error: error.message };
  await svc
    .from("dataroom_audit")
    .insert({ investor_id: investorId, action: "deep_dive_change", detail: { by: op.email, eligible } })
    .then(() => {}, () => {});
  revalidatePath("/investor/admin/investors");
  return { ok: true, rows: await currentInvestors(svc) };
}
