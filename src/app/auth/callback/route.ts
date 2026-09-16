import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadEmployerAdmin } from "@/lib/employer/auth";

/**
 * Email confirmation / magic link callback.
 *
 * Supabase emails point users at /auth/callback with either:
 *   - ?token_hash=...&type=signup|recovery|email_change|invite|magiclink — the
 *     PRIMARY emailed-link flow (all self-service links are issued by
 *     @/lib/supabase/otp in the token_hash flow so they work on any device)
 *   - ?code=... (PKCE flow — exchange for a session; kept for any legacy
 *     PKCE links still in the wild)
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

  // Send auth failures back to the login that matches where they were headed.
  const loginPath = explicitNext?.startsWith("/investor/admin")
    ? "/investor/admin/login"
    : explicitNext?.startsWith("/investor")
      ? "/investor/login"
      : "/login";

  console.log("[auth/callback] hit", {
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type,
    next: explicitNext,
  });

  const supabase = await createClient();

  async function postAuthTarget(): Promise<string> {
    if (explicitNext && explicitNext.startsWith("/")) return explicitNext;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/dashboard";

    // HR is checked FIRST, and it is a different kind of user rather than a
    // competing role. LingoPure's own staff are not learners and not employer
    // admins — the learner dashboard is a dead end for them and nothing in the
    // product chrome links to /hr.
    //
    // This is also the only place the magic-link path can make the decision:
    // the sign-in request knows an email but not an identity, and looking the
    // address up there would leak whether it belongs to staff. Here the session
    // exists, so the question is answerable without telling anyone anything.
    //
    // Swallows its own failure on purpose — a lookup problem must land the user
    // somewhere, not on an error page.
    try {
      const { data: hrEmployeeId } = await supabase.rpc("hr_current_employee");
      if (hrEmployeeId) return "/hr";
    } catch {
      // fall through to the existing destinations
    }

    const admin = await loadEmployerAdmin(supabase, user.id);
    return admin ? "/employer" : "/dashboard";
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(await postAuthTarget(), request.url));
    }
    return NextResponse.redirect(
      new URL(`${loginPath}?error=${encodeURIComponent(error.message)}`, request.url)
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
      new URL(`${loginPath}?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`${loginPath}?error=Missing+verification+code`, request.url)
  );
}
