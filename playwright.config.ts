import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/results/artifacts",
  fullyParallel: false, // shared DB state — keep sequential
  workers: 1,
  retries: 0,
  // Dev-server cold compile of a Next route can take 10s+ on the first
  // visit; bump the per-test ceiling so we don't spuriously time out.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "./tests/e2e/results/html",
        open: "never",
      },
    ],
    ["json", { outputFile: "./tests/e2e/results/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Spin up the dev server automatically when running locally.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
