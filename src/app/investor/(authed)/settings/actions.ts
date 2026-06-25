"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Update the signed-in investor's profile (name/firm). investors has no RLS
 * update policy (reads only), so the write goes through the service-role client
 * scoped to the authenticated user's own id.
 */
export async function updateInvestorProfile(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const fullName = String(formData.get("fullName") ?? "").trim() || null;
  const firm = String(formData.get("firm") ?? "").trim() || null;

  const svc = createAdminClient();
  const { error } = await svc
    .from("investors")
    .update({ full_name: fullName, firm })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}
