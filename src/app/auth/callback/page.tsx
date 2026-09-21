"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Email confirmation / magic link / password reset / recovery landing page.
 *
 * MUST be a CLIENT page, not a server route — see ISS-051. Supabase's
 * hosted `/auth/v1/verify` endpoint (what the default email templates
 * link to, and what `signInWithOtp`/`resetPasswordForEmail`/`signUp` all
 * produce via createOtpIssuerClient) redirects here with the session (or an
 * error) in the URL FRAGMENT (`#access_token=...` / `#error=...`), never in
 * the query string. A server route structurally cannot see a URL fragment —
 * browsers never send it in the HTTP request — so the previous route.ts
 * implementation failed on every single link, surfacing as a confusing
 * "Missing verification code" (fresh link) or, if the single-use token had
 * already been consumed once — most commonly a corporate email client's
 * link-safety scanner pre-fetching it before the user ever clicked —
 * Supabase's own "Email link is invalid or has expired" (Shamini's report).
 *
 * This page handles every shape a link can arrive in:
 *   1. Fragment error   (#error=...&error_code=...&error_description=...)
 *   2. Fragment tokens  (#access_token=...&refresh_token=...)              — the live default
 *   3. Query code       (?code=...)                                        — PKCE exchange
 *   4. Query token_hash (?token_hash=...&type=...)                         — a custom template
 *
 * Five flows land here: student magic-link + signup confirmation +
 * password reset + investor login + investor admin login (all issue links
 * via @/lib/supabase/otp's createOtpIssuerClient). Fixing this one page
 * fixes all five at once.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const ran = useRef(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    // Tokens/codes are single-use — guard against React StrictMode's
    // dev-mode double-invoke burning the token on the first of two calls.
    if (ran.current) return;
    ran.current = true;

    const supabase = createClient();
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const next = query.get("next");

    const loginPath = next?.startsWith("/investor/admin")
      ? "/investor/admin/login"
      : next?.startsWith("/investor")
        ? "/investor/login"
        : "/login";

    function fail(message: string) {
      setErrored(true);
      router.replace(`${loginPath}?error=${encodeURIComponent(message)}`);
    }

    async function finish() {
      try {
        const res = await fetch(
          `/api/auth/post-target${next ? `?next=${encodeURIComponent(next)}` : ""}`
        );
        const { target } = (await res.json()) as { target: string };
        router.replace(target || "/dashboard");
      } catch {
        // The session is already established at this point (cookie set) —
        // a failure resolving the FANCY destination must still land the
        // user somewhere, not on an error page.
        router.replace(next && next.startsWith("/") ? next : "/dashboard");
      }
    }

    async function run() {
      // 1 — fragment error (the live shape for an expired/already-used link).
      const hashError = hash.get("error_description") || hash.get("error");
      if (hashError) {
        fail(hashError.replace(/\+/g, " "));
        return;
      }

      // 2 — fragment tokens (the live shape for a fresh, valid link).
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return fail(error.message);
        return finish();
      }

      // 3 — PKCE code exchange.
      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return fail(error.message);
        return finish();
      }

      // 4 — token_hash + type (a custom email template, or invite links).
      const tokenHash = query.get("token_hash");
      const type = query.get("type");
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "signup" | "recovery" | "email_change" | "invite" | "magiclink",
          token_hash: tokenHash,
        });
        if (error) return fail(error.message);
        return finish();
      }

      fail("Missing verification code");
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy border-t-transparent" />
      <p className="text-sm text-mute">
        {errored ? "Redirecting…" : "Signing you in…"}
      </p>
    </div>
  );
}
