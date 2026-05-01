import {
  test,
  expect,
  ensureTestStudent,
  loginAsTestStudent,
} from "./fixtures";

test.beforeAll(async () => {
  await ensureTestStudent();
});

test.beforeEach(async ({ page }) => {
  await loginAsTestStudent(page);
});

test.describe("student dashboard", () => {
  test("/dashboard renders the gap-profile shell", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /your gap profile/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^skills$/i })
    ).toBeVisible();
  });

  test("/dashboard shows the gamification card with XP + tier", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Card kicker
    await expect(page.getByText(/^progress$/i).first()).toBeVisible();
    // XP label
    await expect(page.getByText(/xp earned/i).first()).toBeVisible();
    // A tier chip — bronze / silver / gold (a fresh test student's target
    // defaults to B2 → silver, but we accept any of the three to keep the
    // assertion robust against target_level changes).
    await expect(
      page.getByText(/(bronze|silver|gold) tier/i).first()
    ).toBeVisible();
  });

  test("/onboarding renders without crashing", async ({ page }) => {
    const response = await page.goto("/onboarding");
    expect(response?.status()).toBeLessThan(500);
    // Either the discovery widget OR a placeholder must render.
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("/lessons hub shows both lesson types", async ({ page }) => {
    await page.goto("/lessons");
    await expect(
      page.getByRole("heading", { name: /practice between classes/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /write a business email/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /record a 60.90 second/i })
    ).toBeVisible();
  });

  test("schedule a demo class then visit /classroom/[id]", async ({ page }) => {
    await page.goto("/dashboard");

    // Trigger schedule via the API directly (the dashboard button only
    // shows when there's no upcoming class — keeps the test deterministic).
    const res = await page.request.post("/api/classin/sessions", {
      data: {},
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { id?: string };
    expect(body.id).toBeTruthy();

    const classroomResp = await page.goto(`/classroom/${body.id}`);
    expect(classroomResp?.status()).toBeLessThan(500);

    // Without ClassIn creds we expect the pending placeholder.
    await expect(
      page.getByRole("heading", { name: /classin integration pending/i })
    ).toBeVisible();
  });

  test("/classroom/[id]/transcribe renders the demo form", async ({ page }) => {
    const res = await page.request.post("/api/classin/sessions", { data: {} });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { id?: string };

    await page.goto(`/classroom/${body.id}/transcribe`);
    await expect(
      page.getByRole("heading", {
        name: /score this class with a transcript/i,
      })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /load sample/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /score this session/i })
    ).toBeVisible();
  });
});
