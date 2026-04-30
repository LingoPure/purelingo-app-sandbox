/**
 * Shared E2E fixtures — known-good test users created via Supabase admin API
 * so we don't depend on the email-confirmation flow (which is currently
 * broken anyway — see /auth/callback gap).
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Load .env.local — Playwright doesn't pick it up automatically.
loadEnv({ path: path.resolve(__dirname, "../../.env.local") });

export const TEST_STUDENT = {
  email: "e2e-student@lingopure.demo",
  password: "Test-1234-LP-e2e",
  name: "E2E Test Student",
};

export const EMPLOYER_PASSWORD =
  process.env.EMPLOYER_DEMO_PASSWORD ?? "lingopure-demo";

function adminClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) — load from .env.local"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Create or refresh the canonical test user. Idempotent — if the user
 * already exists, update the password (in case it was rotated) and
 * return the existing id.
 */
export async function ensureTestStudent(): Promise<{ id: string; email: string }> {
  const admin = adminClient();
  // Search across pages.
  let userId: string | null = null;
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email === TEST_STUDENT.email) {
        userId = u.id;
        break;
      }
    }
    if (userId || data.users.length < 200) break;
    page += 1;
  }

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_STUDENT.email,
      password: TEST_STUDENT.password,
      email_confirm: true,
      user_metadata: { full_name: TEST_STUDENT.name },
    });
    if (error || !data.user) {
      throw new Error(`createUser: ${error?.message ?? "no user returned"}`);
    }
    userId = data.user.id;
  } else {
    // Make sure password + email_confirm are correct for repeat runs.
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: TEST_STUDENT.password,
      email_confirm: true,
      user_metadata: { full_name: TEST_STUDENT.name },
    });
    if (error) throw new Error(`updateUserById: ${error.message}`);
  }

  // Make sure the public.students row exists with sensible values.
  await admin
    .from("students")
    .upsert(
      {
        id: userId,
        email: TEST_STUDENT.email,
        name: TEST_STUDENT.name,
        target_level: "B2",
        discovery_status: "pending",
      },
      { onConflict: "id" }
    );

  return { id: userId, email: TEST_STUDENT.email };
}

export async function loginAsTestStudent(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_STUDENT.email);
  await page.getByLabel(/password/i).fill(TEST_STUDENT.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Default redirect is /dashboard. Make sure we've actually navigated AWAY
  // from /login (a regex like /dashboard|onboarding/ can match too eagerly
  // on Next's transitional URLs).
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login"),
    { timeout: 20_000 }
  );
}

export async function loginAsEmployer(page: Page): Promise<void> {
  await page.goto("/employer/login");
  await page.getByLabel(/access password/i).fill(EMPLOYER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  // The naive regex /\/employer(\/|$)/ matches /employer/login itself, so
  // the wait succeeds instantly — we'd race the form submit. Wait for any
  // /employer/* URL that ISN'T the login page.
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/employer") &&
      url.pathname !== "/employer/login",
    { timeout: 20_000 }
  );
}

export const test = base.extend({});
export { expect };
