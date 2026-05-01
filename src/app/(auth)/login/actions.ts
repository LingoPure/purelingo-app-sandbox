"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadEmployerAdmin } from "@/lib/employer/auth";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectToRaw = String(formData.get("redirectTo") ?? "");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}&redirectTo=${encodeURIComponent(redirectToRaw)}`
    );
  }

  // After successful auth, route based on role:
  //   - explicit redirectTo wins (e.g. coming back from a magic-link)
  //   - employer admins → /employer
  //   - everyone else → /dashboard
  let target = redirectToRaw && redirectToRaw.startsWith("/")
    ? redirectToRaw
    : null;
  if (!target) {
    const admin = await loadEmployerAdmin(supabase, data.user.id);
    target = admin ? "/employer" : "/dashboard";
  }

  revalidatePath("/", "layout");
  redirect(target);
}
