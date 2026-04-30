import { test, expect } from "./fixtures";

test.describe("public pages", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/lingo/i);
  });

  test("/login renders the email + password form", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /welcome back/i })
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("/signup renders the signup form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("/employer/login renders the access password form", async ({ page }) => {
    await page.goto("/employer/login");
    await expect(
      page.getByRole("heading", { name: /lingopure pilot dashboard/i })
    ).toBeVisible();
    await expect(page.getByLabel(/access password/i)).toBeVisible();
  });

  test("protected route redirects to /login when signed out", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/login/);
  });

  test("/employer redirects to /employer/login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/employer");
    await page.waitForURL(/\/employer\/login/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/employer\/login/);
  });
});
