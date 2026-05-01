import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation / magic link callback.
 *
 * Supabase emails point users at {site_url}/auth/callback with either:
 *   - ?code=... (PKCE flow — exchange for a session)
 *   - ?token_hash=...&type=signup|recovery|email_change|invite (older OTP flow)
 *
 * On success we redirect to ?next=... (defaults to /dashboard). On failure we
 * bounce to /login with an error so the user gets a real message instead of
 * the raw access_denied / otp_expired error page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
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
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=Missing+verification+code", request.url)
  );
}
