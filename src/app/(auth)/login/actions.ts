"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Send the signed-in user (or any returning student) a fresh magic link
 * to their email. Required because employer-invited students don't have
 * a password set — `signInWithPassword` is unusable for them, and
 * without this path they'd be locked out the moment their session
 * expired.
 *
 * Supabase's `signInWithOtp` returns success regardless of whether the
 * email exists in auth.users — that's deliberate (email-enumeration
 * protection). We mirror the same behaviour: always show "check your
 * inbox" without leaking which addresses are real.
 */
export async function requestMagicLink(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const redirectToRaw = String(formData.get("redirectTo") ?? "");

  if (!email) {
    redirect(
      `/login?error=${encodeURIComponent("Enter your email address.")}&redirectTo=${encodeURIComponent(redirectToRaw)}`
    );
  }

  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("x-forwarded-proto") && h.get("x-forwarded-host")
      ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
      : `https://${h.get("host") ?? "lingo-pure-ai.vercel.app"}`);
  const next =
    redirectToRaw && redirectToRaw.startsWith("/")
      ? redirectToRaw
      : "/dashboard";
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      // Don't auto-create accounts for unrecognised emails — magic-link
      // self-signup would bypass the employer-invite flow that gates
      // students into a cohort.
      shouldCreateUser: false,
    },
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectToRaw)}`
    );
  }
  redirect(
    `/login?message=${encodeURIComponent("Check your inbox — a sign-in link is on its way.")}&redirectTo=${encodeURIComponent(redirectToRaw)}`
  );
}

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
  // Silent-login guard: auth succeeded but no session was returned (the cookie
  // won't persist) — surface it instead of redirecting into a mystery bounce.
  if (!data.session) {
    redirect(
      `/login?error=${encodeURIComponent("Signed in, but the session didn't persist. Please try again.")}&redirectTo=${encodeURIComponent(redirectToRaw)}`
    );
  }

  // Everyone lands on the learner dashboard (an explicit redirectTo still
  // wins, e.g. from a magic link). Employer admins reach their console via the
  // "Employer console" nav item — so a dual-role / sandbox user experiences the
  // full learner flow first instead of being bounced to /employer.
  const target =
    redirectToRaw && redirectToRaw.startsWith("/") ? redirectToRaw : "/dashboard";

  revalidatePath("/", "layout");
  redirect(target);
}
