"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Investor-portal auth actions (self-contained so errors stay on
 * /investor/login, §8.5 segregation). Investors are invite-provisioned —
 * magic-link does not auto-create accounts.
 */

const LOGIN = "/investor/login";
const HOME = "/investor/ask";

function safeNext(raw: string): string {
  return raw && raw.startsWith("/") ? raw : HOME;
}

export async function investorLogin(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("redirectTo") ?? ""));

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect(`${LOGIN}?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}`);
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function investorMagicLink(formData: FormData) {
  const supabase = await createClient();
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
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(HOME)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  });
  if (error) {
    redirect(`${LOGIN}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(
    `${LOGIN}?message=${encodeURIComponent("Check your inbox — a sign-in link is on its way.")}`
  );
}
