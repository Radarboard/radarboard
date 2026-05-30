import type { APIRequestContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

type E2EScenario = "fresh" | "dashboard";

interface ConsoleFixtures {
  consoleErrors: string[];
  pageErrors: string[];
}

function formatPlaywrightErrors(errors: string[]): string {
  return errors.map((error) => `- ${error}`).join("\n");
}

export const test = base.extend<ConsoleFixtures>({
  consoleErrors: async ({ page }, use) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors.push(message.text());
    });

    await use(consoleErrors);
  },
  pageErrors: async ({ page }, use) => {
    const pageErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await use(pageErrors);
  },
});

export async function resetE2EState(
  request: APIRequestContext,
  scenario: E2EScenario
): Promise<void> {
  const response = await request.post("/api/e2e/state", {
    data: { scenario },
  });

  if (response.status() === 404) {
    throw new Error(
      "The dashboard is not running in E2E mode. Start it with `RADARBOARD_E2E=1` or let Playwright boot the dedicated server in CI."
    );
  }

  if (!response.ok()) {
    throw new Error(`Failed to reset E2E state: ${response.status()} ${await response.text()}`);
  }
}

export async function primeDashboardRoute(request: APIRequestContext, path = "/"): Promise<void> {
  const response = await request.get(path, {
    timeout: 60_000,
  });

  if (!response.ok()) {
    throw new Error(`Failed to prime route ${path}: ${response.status()} ${response.statusText()}`);
  }
}

export async function gotoDashboard(page: Page, path = "/"): Promise<void> {
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(path, {
        waitUntil: "commit",
        timeout: 15_000,
      });
      return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("ERR_ABORTED") ||
        attempt === attempts
      ) {
        throw error;
      }
    }
  }
}

export async function mockDashboardApis(page: Page): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await page.route("**/api/integrations/revenuecat/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/shipping/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, items: [], _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/linear/roadmap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: false,
        projects: [],
        inProgressIssues: [],
        _fetchedAt: now,
      }),
    });
  });

  await page.route("**/api/integrations/openpanel/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/gsc/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/gsc/query**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, rows: [], _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/betterstack/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/app-store-connect/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/sentry/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });
}

/**
 * Fetch persisted settings from the API.
 * Requires the app to be running in E2E mode.
 */
export async function getSettings(request: APIRequestContext): Promise<Record<string, unknown>> {
  const response = await request.get("/api/settings");
  if (!response.ok()) {
    throw new Error(`Failed to fetch settings: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Complete the onboarding wizard from first-run state.
 * Resets to fresh state, navigates through all steps, and clicks "Go to Dashboard".
 */
export async function completeFirstRunOnboarding(
  page: Page,
  request: APIRequestContext,
  options: { demo: boolean }
): Promise<void> {
  await resetE2EState(request, "fresh");
  await mockDashboardApis(page);
  await primeDashboardRoute(request);
  await gotoDashboard(page);

  // Wait for the database setup dialog and complete it
  await page.waitForResponse((r) => r.url().includes("/api/database/config"));
  const setupDialog = page.getByRole("dialog", { name: "Database Setup" });
  await setupDialog.waitFor({ state: "visible", timeout: 15_000 });

  // Click through DB setup (SQLite is default)
  await setupDialog.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("dialog", { name: "Configure SQLite" }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Save & Continue" }).click();
  await page.getByRole("dialog", { name: "Setup Complete" }).waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Go to Dashboard" }).click();

  // Onboarding wizard should appear
  const onboardingDialog = page.getByRole("dialog");
  await onboardingDialog.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Welcome to Radarboard").waitFor({ state: "visible", timeout: 10_000 });

  // Step 1: Choose demo or normal mode
  if (options.demo) {
    await page.getByText("Start with demo data").click();
  } else {
    await page.getByText("Start fresh").click();
  }

  // Step 2: Profile — skip
  await page.getByRole("button", { name: "Skip" }).click();
  // Step 4: Integrations — skip (step 3 DB is skipped for returning/preview)
  await page.getByRole("button", { name: "Skip" }).click();
  // Step 5: Plugins — skip
  await page.getByRole("button", { name: "Skip" }).click();
  // Step 6: Layout — skip
  await page.getByRole("button", { name: "Skip" }).click();

  // Step 7: Complete
  await page.getByText("You're all set").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("button", { name: "Go to Dashboard" }).click();
  await onboardingDialog.waitFor({ state: "hidden", timeout: 5_000 });

  // Wait for the debounced settings save to complete (300ms debounce + network)
  await page.waitForTimeout(1_000);
}

export async function assertNoRuntimeErrors(
  consoleErrors: string[],
  pageErrors: string[]
): Promise<void> {
  expect
    .soft(consoleErrors, `Console errors:\n${formatPlaywrightErrors(consoleErrors)}`)
    .toEqual([]);
  expect.soft(pageErrors, `Page errors:\n${formatPlaywrightErrors(pageErrors)}`).toEqual([]);
}
