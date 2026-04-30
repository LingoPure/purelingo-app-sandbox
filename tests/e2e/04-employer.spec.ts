import { test, expect, loginAsEmployer } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await loginAsEmployer(page);
});

test.describe("employer dashboard", () => {
  test("/employer overview renders the metric tiles + radar", async ({
    page,
  }) => {
    await page.goto("/employer");
    await expect(
      page.getByRole("heading", { name: /^overview$/i })
    ).toBeVisible();
    await expect(
      page.getByText(/active students/i).first()
    ).toBeVisible();
    await expect(page.getByText(/lessons completed/i).first()).toBeVisible();
    await expect(page.getByText(/at target/i).first()).toBeVisible();
  });

  test("/employer/students roster renders the table", async ({ page }) => {
    await page.goto("/employer/students");
    await expect(
      page.getByRole("heading", { name: /^students$/i })
    ).toBeVisible();
    // Header row should contain "Student" and "Target".
    await expect(page.locator("th").filter({ hasText: /student/i })).toBeVisible();
    await expect(page.locator("th").filter({ hasText: /target/i })).toBeVisible();
  });

  test("seed button populates the cohort and the roster fills", async ({
    page,
  }) => {
    // Idempotent — safe whether or not the cohort already exists.
    const res = await page.request.post("/api/employer/seed");
    expect(res.ok()).toBeTruthy();

    await page.goto("/employer/students");
    // At least one of the seeded students must appear.
    await expect(
      page.getByText(/nguyễn thị hà|trần văn minh|phạm thu hương/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a roster row opens the per-student detail page", async ({
    page,
  }) => {
    await page.request.post("/api/employer/seed");
    await page.goto("/employer/students");

    // First "Open" link or first student name link.
    await page
      .getByRole("link", { name: /nguyễn thị hà|trần văn minh|phạm thu hương|đoàn quốc việt|lê hoàng anh/i })
      .first()
      .click();

    await page.waitForURL(/\/employer\/students\/[0-9a-f-]+/, {
      timeout: 10_000,
    });
    // "Student profile" is a kicker paragraph; the H1 is the student's
    // name. Anchor on the structural elements that reliably exist:
    // the back-to-roster link + the Gap profile section heading.
    await expect(
      page.getByRole("link", { name: /← roster/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /gap profile/i })
    ).toBeVisible();
  });
});
