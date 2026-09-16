"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOtpIssuerClient } from "@/lib/supabase/otp";
import { isOperator } from "@/lib/investor/operator-auth";

/**
 * Operator-console auth actions. §8.5: the reject for a non-operator happens
 * POST-authentication — we sign in, then if the email isn't on the ADMIN_EMAILS
 * allowlist we sign back out and bounce with an error (never block at the form).
 */

const LOGIN = "/investor/admin/login";
const HOME = "/investor/admin";

export async function operatorLogin(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect(`${LOGIN}?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}`);
  }
  // Post-auth allowlist check.
  if (!isOperator(data.user.email)) {
    await supabase.auth.signOut();
    redirect(`${LOGIN}?error=${encodeURIComponent("This account is not an operator.")}`);
  }
  revalidatePath("/", "layout");
  redirect(HOME);
}

export async function operatorMagicLink(formData: FormData) {
  const supabase = createOtpIssuerClient();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(`${LOGIN}?error=${encodeURIComponent("Enter your email address.")}`);
  }
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("x-forwarded-proto") && h.get("x-forwarded-host")
      ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
      : `https://${h.get("host") ?? "purelingo-app-sandbox.vercel.app"}`);
  // Lands at /investor/admin; the admin layout enforces the allowlist (post-auth reject).
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(HOME)}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  });
  if (error) {
    redirect(`${LOGIN}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`${LOGIN}?message=${encodeURIComponent("Check your inbox — a sign-in link is on its way.")}`);
}
