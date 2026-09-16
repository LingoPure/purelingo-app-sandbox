import { test, expect, loginAsEmployer, loginAsTestStudent } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * 06 — role-matrix route smoke (C7).
 *
 * Hits the same URLs as different personas and asserts can/cannot belong —
 * the route half of docs/ROLE_MATRIX.md (the DB half runs via test:org:db).
 *
 * The two provisionable personas here are the test student (/login) and the
 * employer demo admin (/employer/login). Every OTHER portal (/admin, /teacher,
 * /org/[slug]) must bounce them — those bounces are the NEW assertions this
 * spec adds on top of 02–04 (which already prove the positive hits for
 * /dashboard and /employer). Portal-admin positives are enforced by the
 * DB grid in the org RLS harness, which impersonates owner/hr/teacher/
 * staff/platform-admin at the row level.
 */

const GUEST_PORTALS = ["/admin", "/teacher", "/org/celadon-portal", "/employer"];

async function assertRedirectAway(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // The portal gate must send the persona somewhere else — the assertion is
  // "never sits on a portal you are not allowed to reach".
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .not.toBe(path);
}

test.describe("role-matrix: no cross-portal access (denials)", () => {
  test.describe("as the test student", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsTestStudent(page);
    });

    for (const path of GUEST_PORTALS) {
      test(`bounced off ${path}`, async ({ page }) => {
        await assertRedirectAway(page, path);
      });
    }
  });

  test.describe("as the employer demo admin", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsEmployer(page);
    });

    for (const path of ["/admin", "/teacher", "/org/celadon-portal"]) {
      test(`bounced off ${path}`, async ({ page }) => {
        await assertRedirectAway(page, path);
      });
    }
  });
});

test.describe("role-matrix: same-role reach (positives already in 02–04)", () => {
  test("student reaches /dashboard, employer reaches /employer", async ({
    page,
  }) => {
    await loginAsTestStudent(page);
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);

    await page.context().clearCookies();
    await page.goto("/");
    await loginAsEmployer(page);
    await page.goto("/employer/students");
    await expect(page).not.toHaveURL(/\/employer\/login/);
  });
});