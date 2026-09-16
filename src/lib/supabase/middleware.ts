import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/classroom",
  "/profile",
  "/lessons",
  "/exam",
  // /employer/* is gated by Supabase auth — anyone signed-in passes the
  // middleware; the layout component checks employer_admins for the
  // actual authorisation step.
  "/employer",
  // /hr/* follows the same shape: any signed-in user passes here, and
  // src/app/hr/layout.tsx checks hr_current_employee() for the real
  // authorisation. Listed so that a missing Supabase env redirects to /login
  // instead of rendering a page that then talks to a null client. Note this is
  // a HOST-APP mount point, not part of the portable HR module — the handover
  // manifest records it as one of the edits the destination repo must make.
  "/hr",
];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase env vars: let public traffic through; bounce protected
  // routes to /login so the page render never tries to talk to a null client.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", path);
      url.searchParams.set(
        "error",
        "Auth not configured — set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const requestCookies = request.cookies.getAll();
  const hasAuthCookie = requestCookies.some((c) => c.name.includes("-auth-token"));

  // Only hit the network when a session cookie actually exists. With no cookie there is
  // nothing to verify — doing the round-trip anyway is pure latency on every public page
  // and turns a slow/blocked Supabase connection into a site-wide 504 MIDDLEWARE timeout.
  let user = null;
  let error = null;
  if (hasAuthCookie) {
    try {
      const res = await supabase.auth.getUser();
      user = res.data.user;
      error = res.error;
    } catch {
      // Network failure reaching Supabase from the edge. FAIL OPEN — let the request through;
      // the page's own getUser gate (Node runtime, bigger budget) re-checks and bounces if the
      // session is genuinely gone. A transient connectivity blip must not 504 the whole app.
      return supabaseResponse;
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    // Fail OPEN on a transient auth error when a session cookie is present — a
    // cold-start network blip to Supabase (Tokyo) returns an error + null user,
    // and bouncing here would silently log a valid session out. Let the request
    // through; the page's own getUser gate re-checks and bounces if it's really
    // gone. Only redirect on a genuine no-session.
    if (error && hasAuthCookie) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    // Surface the reason so a dropped/expired session isn't a silent bounce.
    url.searchParams.set("message", "Please sign in to continue.");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
