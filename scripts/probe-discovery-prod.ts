/**
 * One-shot prod probe for the discovery session.
 *
 * Logs in as the e2e test student, opens /onboarding, clicks
 * "Start discovery session", and captures:
 *   - browser console output (info/warn/error)
 *   - page-level errors (uncaught exceptions)
 *   - failed network requests
 *   - the on-screen status pill + visible error text
 *
 * Run with:  npx tsx scripts/probe-discovery-prod.ts
 */

import { chromium, type ConsoleMessage } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

const PROD_URL = "https://lingo-pure-ai.vercel.app";
const EMAIL = "e2e-student@lingopure.demo";
const PASSWORD = "Test-1234-LP-e2e";

const ts = () => new Date().toISOString().slice(11, 23);

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({
    permissions: ["microphone"],
  });
  await context.grantPermissions(["microphone"], { origin: PROD_URL });
  const page = await context.newPage();

  page.on("console", (msg: ConsoleMessage) => {
    const t = msg.type();
    if (t === "info" || t === "warning" || t === "error" || t === "log") {
      console.log(`[${ts()}] [console.${t}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`[${ts()}] [pageerror] ${err.name}: ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    const f = req.failure();
    console.log(
      `[${ts()}] [requestfailed] ${req.method()} ${req.url()} — ${f?.errorText ?? "unknown"}`
    );
  });
  page.on("websocket", (ws) => {
    console.log(`[${ts()}] [ws.open] ${ws.url()}`);
    ws.on("close", () => console.log(`[${ts()}] [ws.close] ${ws.url()}`));
    ws.on("socketerror", (e) =>
      console.log(`[${ts()}] [ws.error] ${ws.url()} — ${e}`)
    );
  });

  console.log(`[${ts()}] navigating to ${PROD_URL}/login`);
  await page.goto(`${PROD_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.context().addCookies([
    { name: "lp_lang", value: "en", domain: "lingo-pure-ai.vercel.app", path: "/" },
  ]);

  console.log(`[${ts()}] filling login form`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login"),
    { timeout: 20_000 }
  );
  console.log(`[${ts()}] logged in, at ${page.url()}`);

  console.log(`[${ts()}] navigating to /onboarding`);
  await page.goto(`${PROD_URL}/onboarding`, { waitUntil: "networkidle" });

  const startBtn = page.getByRole("button", { name: /start discovery session|connecting/i });
  await startBtn.waitFor({ state: "visible", timeout: 10_000 });
  console.log(`[${ts()}] start button visible`);

  // Force-wait for React hydration to attach handlers.
  await page.waitForTimeout(2_500);

  // Inspect the button: does it have a React fiber + onClick?
  const fiberInfo = await startBtn.evaluate((el) => {
    const fiberKey = Object.keys(el).find(
      (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$")
    );
    const propsKey = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    // @ts-expect-error — runtime inspection
    const props = propsKey ? el[propsKey] : null;
    return {
      hasFiberKey: Boolean(fiberKey),
      hasPropsKey: Boolean(propsKey),
      hasOnClick: Boolean(props && typeof props.onClick === "function"),
      disabled: (el as HTMLButtonElement).disabled,
      tagName: el.tagName,
      text: el.textContent?.trim() ?? "",
    };
  });
  console.log(`[${ts()}] button inspection: ${JSON.stringify(fiberInfo)}`);

  // Capture pre-click status.
  const preStatus = await page.locator("text=/^status:/i").first().textContent().catch(() => null);
  console.log(`[${ts()}] pre-click status pill: ${preStatus}`);

  console.log(`[${ts()}] clicking Start (Playwright click)`);
  await startBtn.click();
  await page.waitForTimeout(1_500);

  // If status didn't change, also try a direct JS click — bypasses any
  // pointer-events / overlay weirdness.
  const midStatus = await page.locator("text=/^status:/i").first().textContent().catch(() => null);
  console.log(`[${ts()}] +1.5s status: ${midStatus}`);
  if (midStatus && /disconnected/i.test(midStatus)) {
    console.log(`[${ts()}] click had no effect — retrying via element.click()`);
    await startBtn.evaluate((el) => (el as HTMLButtonElement).click());
  }

  // Watch the status pill for ~12s.
  const deadline = Date.now() + 12_000;
  let lastStatus: string | null = null;
  while (Date.now() < deadline) {
    const cur = await page
      .locator("text=/^status:/i")
      .first()
      .textContent()
      .catch(() => null);
    if (cur && cur !== lastStatus) {
      console.log(`[${ts()}] status pill: ${cur}`);
      lastStatus = cur;
    }
    await page.waitForTimeout(250);
  }

  // Capture any visible error block.
  const errorText = await page
    .locator('[role="alert"], .text-rose-700, .text-red-600, [class*="error"]')
    .allTextContents()
    .catch(() => []);
  if (errorText.length) {
    console.log(`[${ts()}] visible error elements: ${JSON.stringify(errorText)}`);
  } else {
    console.log(`[${ts()}] no visible error elements`);
  }

  // Final screenshot for evidence.
  const shotPath = path.resolve(__dirname, "../tmp/discovery-prod.png");
  await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
  console.log(`[${ts()}] screenshot: ${shotPath}`);

  await browser.close();
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
