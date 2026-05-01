import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadEmployerAdmin } from "@/lib/employer/auth";

/**
 * Email confirmation / magic link callback.
 *
 * Supabase emails point users at {site_url}/auth/callback with either:
 *   - ?code=... (PKCE flow — exchange for a session)
 *   - ?token_hash=...&type=signup|recovery|email_change|invite (older OTP flow)
 *
 * On success we redirect to ?next=... if explicitly set; otherwise we
 * route admins to /employer and everyone else to /dashboard. On failure
 * we bounce to /login with the error message.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const explicitNext = url.searchParams.get("next");

  const supabase = await createClient();

  async function postAuthTarget(): Promise<string> {
    if (explicitNext && explicitNext.startsWith("/")) return explicitNext;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/dashboard";
    const admin = await loadEmployerAdmin(supabase, user.id);
    return admin ? "/employer" : "/dashboard";
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(await postAuthTarget(), request.url));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as
        | "signup"
        | "recovery"
        | "email_change"
        | "invite"
        | "magiclink",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(await postAuthTarget(), request.url));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=Missing+verification+code", request.url)
  );
}
