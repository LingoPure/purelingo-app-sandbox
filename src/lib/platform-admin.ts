/**
 * Platform-admin auth for the LingoPure org hierarchy (C1).
 *
 * Canonical source of truth is the `platform_admins` table (0038). The legacy
 * ADMIN_EMAILS allowlist — the same convention the investor operator console
 * uses — SEEDS the table via a first-time sync, then the table owns the
 * decision. This keeps one mechanism (DB-backed) canonical across the growing
 * admin surface while preserving env-var bootstrap.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const PLATFORM_ADMIN_TABLE = "platform_admins";

/** The bootstrap allowlist (ADMIN_EMAILS env, else the operator defaults). */
export function platformAdminBootstrapEmails(): string[] {
  const env = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (env.length) return env;

  const DEFAULT_PLATFORM_ADMINS = [
    "dennis@corporateaisolutions.com",
    "mcmdennis@gmail.com",
  ];
  return DEFAULT_PLATFORM_ADMINS.map((e) => e.toLowerCase());
}

/**
 * First-time sync: upserts every bootstrap-allowlisted email into
 * platform_admins (via service role). Safe to run repeatedly — it only inserts
 * rows that do not yet exist. Returns the number of rows added.
 */
export async function bootstrapPlatformAdmins(): Promise<number> {
  const admin = createAdminClient();
  const emails = platformAdminBootstrapEmails();

  const { data: users, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) {
    throw new Error(`platform-admin bootstrap: failed to list users — ${usersError.message}`);
  }

  const candidates = (users?.users ?? []).filter((u) =>
    emails.includes((u.email ?? "").toLowerCase())
  );

  let added = 0;
  for (const candidate of candidates) {
    const { error } = await admin
      .from(PLATFORM_ADMIN_TABLE)
      .upsert({ user_id: candidate.id }, { onConflict: "user_id" });
    if (error) {
      throw new Error(`platform-admin bootstrap: upsert ${candidate.email} failed — ${error.message}`);
    }
    added += 1;
  }
  return added;
}

/**
 * Is the given user a platform admin? Full portal gate — call before any
 * /admin surface renders. Reads the canonical table (not the allowlist).
 */
export async function isPlatformAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(PLATFORM_ADMIN_TABLE)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`platform-admin check failed — ${error.message}`);
  }
  return Boolean(data);
}

/** Returns the current session user's id when they are a platform admin. */
export async function getPlatformAdmin(): Promise<{ user_id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isPlatformAdmin(user.id))) return null;
  return { user_id: user.id };
}