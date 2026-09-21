import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthTarget } from "@/lib/supabase/post-auth-target";

/**
 * GET /api/auth/post-target?next=... — called by the client-side
 * /auth/callback page AFTER it has established the session (so the session
 * cookie is already set and visible here). Resolves the same HR/employer/
 * learner destination the password-login path uses, without exposing the
 * service-role employer-admin lookup to the browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");

  const supabase = await createClient();
  const target = await resolvePostAuthTarget(supabase, next);

  return NextResponse.json({ target });
}
