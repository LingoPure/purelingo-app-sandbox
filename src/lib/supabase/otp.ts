import { createClient } from "@supabase/supabase-js";

/**
 * Email-link ISSUING client for magic-link / signup / recovery emails.
 *
 * The SSR client (@/lib/supabase/server) forces PKCE (flowType: "pkce"), so
 * links it issues carry a ?code= that can only be exchanged by the same
 * browser that requested them — the code verifier lives in that browser's
 * cookies. Opening such a link anywhere else (a different browser or device,
 * a copied-forward link, or after cookies were cleared) fails with
 * "PKCE code verifier not found in storage" and the user is dead-ended.
 *
 * This client issues links in the token_hash flow instead: each emailed link
 * embeds a single-use token that /auth/callback verifies via
 * supabase.auth.verifyOtp({ token_hash, type }) with no client-side state at
 * all, so it works on any device. Invites already use this shape
 * (auth.admin.generateLink); this brings the self-service flows in line.
 *
 * Server-only (must never be used in client code — it holds no session and
 * is only ever called from server actions / route handlers).
 */
export function createOtpIssuerClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "implicit",
      },
    }
  );
}