import { test, expect } from "@playwright/test";

/**
 * Clean-view integrity (patch: CLAUDE_CODE_PATCH_clean_view_integrity.md).
 *
 * Clean view must read as a real, if incomplete, marketing site — never a
 * broken one. No editorial/spec vocabulary may leak into it, empty sections
 * must be ABSENT (not hidden), and no invented statistic or lorem client may
 * exist anywhere.
 */

// Editorial vocabulary that belongs only in annotations (hidden in clean) —
// it must never appear in a visitor-facing (data) field.
const SPEC_VOCAB = [
  "illustrative",
  "placeholder",
  "todo",
  "awaiting",
  "replace with",
  "owner:",
  "evidence pending",
  "answer pending",
  "pending",
  // Scaffold editorial notes must live in annotations, not visible copy (Patch 02 §3).
  "scaffold",
  "the b2b argument lives here",
  "the b2c argument lives here",
];

async function gotoClean(page: import("@playwright/test").Page) {
  await page.goto("/");
  // When canvas mode is on the default is Spec view — switch to Clean.
  const cleanBtn = page.getByRole("button", { name: /clean view/i });
  if (await cleanBtn.count()) await cleanBtn.first().click();
}

test("no spec/editorial vocabulary leaks into clean view", async ({ page }) => {
  await gotoClean(page);
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const term of SPEC_VOCAB) {
    expect(body, `"${term}" must not appear in clean view`).not.toContain(term);
  }
});

test("empty sections are absent from the clean-view DOM, not merely hidden", async ({
  page,
}) => {
  await gotoClean(page);
  // TrustBand, Testimonials and Objections have no shippable data → gone.
  await expect(page.getByText("Not testimonials. Receipts.")).toHaveCount(0);
  await expect(page.getByText("The things you were about to ask.")).toHaveCount(0);
  await expect(page.getByText("placement reports issued")).toHaveCount(0);
  // The real page still exists.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Three steps, and the first one is free.")).toBeVisible();
});

test("no invented statistic or lorem client exists anywhere", async ({ page }) => {
  await page.goto("/");
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("1,200+");
  expect(body).not.toContain("Client 03");
  expect(body).not.toContain("Client 04");
});
