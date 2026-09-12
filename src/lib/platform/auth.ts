/**
 * LingoPure — Platform admin authorisation (C4).
 *
 * `/admin/*` is gated on a row in `public.platform_admins` (canonical, 0038),
 * seeded from the ADMIN_EMAILS bootstrap by `admin:seed-platform`. The check
 * is a database call — `platform_is_admin()` (0044) — never a local list, so
 * the same rule governs the pages, the routes and the RLS policies.
 *
 * Follows the employer/HR auth conventions: the server layout calls
 * `requirePlatformAdmin`, API routes call the guard and short-circuit on a
 * NextResponse.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Is this user a platform admin? Reads through RLS (self-select grants it). */
export async function isPlatformAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Returns the signed-in user + whether they are a platform admin, or a
 * NextResponse the caller must return. Mirrors requireEmployerAdmin.
 *
 *   const guard = await requirePlatformAdmin();
 *   if (guard instanceof NextResponse) return guard;
 *   const { user } = guard;
 */
export async function requirePlatformAdmin(): Promise<
  { user: User } | import("next/server").NextResponse
> {
  const { NextResponse } = await import("next/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const admin = await isPlatformAdmin(supabase, user.id);
  if (!admin) {
    return NextResponse.json(
      { error: "Not authorised — platform admin only" },
      { status: 403 }
    );
  }
  return { user };
}