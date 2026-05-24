"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Set a new password. The recovery session was already established by
 * /auth/callback exchanging the ?code from the reset email, so supabase.auth
 * has an authenticated user here. We update the password, then send the user
 * to /login to sign in fresh with it.
 */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Password must be at least 6 characters.")}`
    );
  }
  if (password !== confirm) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Passwords don't match.")}`
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Your reset link has expired. Request a new one from the sign-in page.")}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(
    `/login?message=${encodeURIComponent("Password updated. Sign in with your new password.")}`
  );
}
