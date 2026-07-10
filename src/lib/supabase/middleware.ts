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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    // Fail OPEN on a transient auth error when a session cookie is present — a
    // cold-start network blip to Supabase (Tokyo) returns an error + null user,
    // and bouncing here would silently log a valid session out. Let the request
    // through; the page's own getUser gate re-checks and bounces if it's really
    // gone. Only redirect on a genuine no-session.
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.includes("-auth-token"));
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
