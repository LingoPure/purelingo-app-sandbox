"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createOtpIssuerClient } from "@/lib/supabase/otp";

export async function signup(formData: FormData) {
  const supabase = createOtpIssuerClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");

  // Build the absolute callback URL from the current request origin so
  // local dev signups confirm to localhost and prod signups confirm to the
  // deployed site — without depending on Supabase's site_url default.
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("x-forwarded-proto") && h.get("x-forwarded-host")
      ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
      : `https://${h.get("host") ?? "purelingo-app-sandbox.vercel.app"}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is required, Supabase returns user with no session.
  if (data.user && !data.session) {
    redirect(
      `/signup?message=${encodeURIComponent("Check your inbox to confirm your email, then sign in.")}`
    );
  }

  redirect("/onboarding");
}
