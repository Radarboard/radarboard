import { resolve } from "node:path";
import { env } from "node:process";
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(env.CI);
const baseURL = env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1365";
const webServerURL = new URL("/api/database/config", baseURL).toString();
const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/_helpers/**"],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 60_000,
  reporter: isCI
    ? [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
    headless: !env.PLAYWRIGHT_HEADED,
  },
  webServer: {
    command: isCI
      ? "pnpm --filter @radarboard/app serve:e2e"
      : "pnpm --filter @radarboard/app dev:e2e",
    cwd: repoRoot,
    url: webServerURL,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 300_000,
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "tablet",
      testMatch: /onboarding/,
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "mobile",
      testMatch: /onboarding/,
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
