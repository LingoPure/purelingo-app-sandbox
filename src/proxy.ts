import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  RETURN_TO_COOKIE,
  RETURN_TO_TTL_SECONDS,
  validateReturnTo,
} from "@/lib/cross-app/return-validate";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // Cross-app deep-link: a partner (currently AIFTIS-Demo) sends the
  // student here with ?returnTo=<their origin>. Validate, then persist
  // to a cookie so the "Back to <partner>" pill survives the auth
  // redirects (login/signup) and stays visible across (app) pages.
  const rawReturnTo = request.nextUrl.searchParams.get("returnTo");
  if (rawReturnTo) {
    const origin = validateReturnTo(rawReturnTo);
    if (origin) {
      response.cookies.set({
        name: RETURN_TO_COOKIE,
        value: origin,
        maxAge: RETURN_TO_TTL_SECONDS,
        sameSite: "lax",
        path: "/",
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
