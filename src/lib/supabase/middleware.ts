import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  EMPLOYER_COOKIE_NAME,
  cookieIsValid,
} from "@/lib/employer/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/classroom",
  "/profile",
  "/lessons",
];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ── Employer-side auth gate (separate from Supabase student auth) ──
  // Everything under /employer/* requires the shared cookie except the
  // login page itself.
  if (path.startsWith("/employer") && path !== "/employer/login") {
    const cookie = request.cookies.get(EMPLOYER_COOKIE_NAME)?.value;
    if (!(await cookieIsValid(cookie))) {
      const url = request.nextUrl.clone();
      url.pathname = "/employer/login";
      url.searchParams.set("redirectTo", path);
      return NextResponse.redirect(url);
    }
  }

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
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
