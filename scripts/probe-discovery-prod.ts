/**
 * One-shot prod probe for the discovery session.
 *
 * Logs in as the e2e test student, opens /onboarding/session (which
 * auto-starts — no Start button to click anymore after the WebSocket-
 * only rewrite), and captures:
 *   - browser console output (info/warn/error)
 *   - page-level errors (uncaught exceptions)
 *   - failed network requests
 *   - WebSocket lifecycle events (open/close/error)
 *   - the on-screen status text + visible error text
 *   - Pause / End button enablement + click responsiveness
 *
 * Run with:  npx tsx scripts/probe-discovery-prod.ts
 */

import { chromium, type ConsoleMessage } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

const PROD_URL = "https://purelingo-app-sandbox.vercel.app";
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
    { name: "lp_lang", value: "en", domain: "purelingo-app-sandbox.vercel.app", path: "/" },
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

  // Go straight to /onboarding/session — that's the page with the live
  // discovery UI and auto-start. /onboarding shows the role-confirm
  // overview, not the call.
  console.log(`[${ts()}] navigating to /onboarding/session`);
  await page.goto(`${PROD_URL}/onboarding/session`, {
    waitUntil: "domcontentloaded",
  });

  // The page auto-starts on mount — no Start button to click. We just
  // watch the status text + button states evolve.
  const statusLocator = page.locator("text=/^status:/i").first();

  // Watch the status text for ~25s (enough time for getUserMedia → token
  // fetch → WebSocket connect → onConnect callback). With WebSocket-only
  // we expect: idle → connecting → connected. If we never reach
  // "connected", that's the bug we want to surface.
  const deadline = Date.now() + 25_000;
  let lastStatus: string | null = null;
  while (Date.now() < deadline) {
    const cur = await statusLocator.textContent().catch(() => null);
    if (cur && cur !== lastStatus) {
      console.log(`[${ts()}] status: ${cur}`);
      lastStatus = cur;
      if (/connected/i.test(cur) && !/disconnected/i.test(cur)) break;
    }
    await page.waitForTimeout(250);
  }

  // Inspect the Pause / End buttons after the connection settles.
  const buttonStates = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons
      .filter((b) =>
        /pause|resume|end session/i.test(b.textContent ?? "")
      )
      .map((b) => ({
        text: b.textContent?.trim() ?? "",
        disabled: (b as HTMLButtonElement).disabled,
        className: b.className.slice(0, 80),
      }));
  });
  console.log(`[${ts()}] action buttons: ${JSON.stringify(buttonStates)}`);

  // Capture any visible error block — the LingoPure error CTA uses
  // text-coral, not text-rose-700, so we widen the selector.
  const errorText = await page
    .locator(
      '[role="alert"], .text-coral, .text-rose-700, .text-red-600, [class*="error"]'
    )
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
