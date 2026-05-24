"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Send a password-reset email. The link points at /auth/callback?next=/reset-password
 * (the existing callback exchanges the recovery code for a session, then forwards to
 * the reset-password page where the user sets a new password).
 *
 * Like the magic-link path, we always show "check your inbox" regardless of whether
 * the email exists — email-enumeration protection.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Enter your email address.")}`
    );
  }

  const supabase = await createClient();

  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("x-forwarded-proto") && h.get("x-forwarded-host")
      ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
      : `https://${h.get("host") ?? "lingo-pure-ai.vercel.app"}`);

  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Log server-side but still show the neutral success message so we don't
    // leak which addresses are registered.
    console.error("[forgot-password] resetPasswordForEmail error:", error.message);
  }

  redirect(
    `/forgot-password?message=${encodeURIComponent(
      "If that email is registered, a reset link is on its way. Check your inbox."
    )}`
  );
}
