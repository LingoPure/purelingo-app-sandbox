"use server";

import { revalidatePath } from "next/cache";
import { getOperator } from "@/lib/investor/operator-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/investor/auth";

export type ActionResult = { ok?: boolean; error?: string; inviteLink?: string };

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
  const tier = String(formData.get("tier") ?? "main") as Tier;
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (!["main", "restricted"].includes(tier)) return { error: "Invalid tier." };

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
      { id: userId, email, full_name: fullName, firm, max_tier: tier, status: "active", invited_by: op.email },
      { onConflict: "id" }
    );
    if (up.error) return { error: up.error.message };

    await svc
      .from("dataroom_audit")
      .insert({ investor_id: userId, action: "invite", detail: { by: op.email, tier } })
      .then(() => {}, () => {});

    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://lingo-pure-ai.vercel.app";
    const link = await svc.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/callback?next=/investor/ask` },
    });

    revalidatePath("/investor/admin/investors");
    return { ok: true, inviteLink: link.data?.properties?.action_link };
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
  return { ok: true };
}

/** Set an investor's max tier (deep-dive grant/ungrant) without requiring the NDA flow. */
export async function setInvestorTier(investorId: string, tier: Tier): Promise<ActionResult> {
  const op = await getOperator();
  if (!op) return { error: "Not authorised." };
  if (!["main", "restricted"].includes(tier)) return { error: "Invalid tier." };
  const svc = createAdminClient();
  const { error } = await svc.from("investors").update({ max_tier: tier }).eq("id", investorId);
  if (error) return { error: error.message };
  await svc
    .from("dataroom_audit")
    .insert({ investor_id: investorId, action: "tier_change", detail: { by: op.email, tier } })
    .then(() => {}, () => {});
  revalidatePath("/investor/admin/investors");
  return { ok: true };
}
