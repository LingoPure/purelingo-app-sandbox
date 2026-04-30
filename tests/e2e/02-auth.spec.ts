import {
  test,
  expect,
  ensureTestStudent,
  loginAsTestStudent,
  TEST_STUDENT,
} from "./fixtures";

test.beforeAll(async () => {
  await ensureTestStudent();
});

test.describe("student auth", () => {
  test("login with the seeded test student lands on the dashboard", async ({
    page,
  }) => {
    await loginAsTestStudent(page);
    expect(page.url()).toMatch(/\/dashboard|\/onboarding/);
  });

  test("login with a wrong password surfaces an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_STUDENT.email);
    await page.getByLabel(/password/i).fill("definitely-not-the-right-pw");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Action redirects to /login?error=...
    await page.waitForURL(/\/login\?.*error=/, { timeout: 10_000 });
    await expect(
      page.locator("div").filter({ hasText: /invalid|credentials/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("signing out returns to /login", async ({ page }) => {
    await loginAsTestStudent(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login|\/$/, { timeout: 10_000 });
  });
});
