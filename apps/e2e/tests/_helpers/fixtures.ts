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
  const response = await request.post("/api/dev/e2e/state", {
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

  await page.route("**/api/integrations/google-search-console/data**", async (route) => {
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

  await page.route("**/api/integrations/open-collective/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/github-sponsors/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, _fetchedAt: now }),
    });
  });

  await page.route("**/api/integrations/raindrop/data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: false,
        source: "api",
        summary: {
          savedCount: 0,
          totalCollections: 0,
          totalTags: 0,
          recentCount: 0,
        },
        recent: [],
        collections: [],
        topTags: [],
        _fetchedAt: now,
      }),
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
  if (!options.demo) {
    await mockDashboardApis(page);
  }
  await primeDashboardRoute(request);
  await gotoDashboard(page);

  // SQLite first-run can auto-configure and skip the setup dialog. Support both
  // paths so onboarding tests match the current desktop default.
  const setupDialog = page.getByRole("dialog", { name: "Database Setup" });
  const welcomeText = page.getByRole("heading", { name: "Welcome to Radarboard" });
  const initialSurface = await Promise.any([
    setupDialog.waitFor({ state: "visible", timeout: 30_000 }).then(() => "setup" as const),
    welcomeText.waitFor({ state: "visible", timeout: 30_000 }).then(() => "onboarding" as const),
  ]);

  if (initialSurface === "setup") {
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
  }

  // Onboarding wizard should appear
  const onboardingDialog = page.getByRole("dialog");
  await onboardingDialog.waitFor({ state: "visible", timeout: 15_000 });
  await welcomeText.waitFor({ state: "visible", timeout: 10_000 });

  // Step 1: Choose demo or normal mode
  if (options.demo) {
    await page.getByRole("button", { name: /^Start with demo data/ }).click();
    await page.getByText("You're all set").waitFor({ state: "visible", timeout: 10_000 });
  } else {
    await page.getByRole("button", { name: /^Start fresh/ }).click();

    // Step 2: Profile — required
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Database may be a visible step or may auto-configure. Advance until the
    // plugin step is visible, leaving integrations unselected.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await onboardingDialog.getByText("Choose which plugins to enable").isVisible()) break;
      await onboardingDialog.getByRole("button", { name: "Continue" }).last().click();
    }

    await onboardingDialog
      .getByText("Choose which plugins to enable")
      .waitFor({ state: "visible", timeout: 10_000 });

    // Step 5: Plugins — skip optional plugins when the skip action is present.
    const skipPlugins = onboardingDialog.getByRole("button", { name: "Skip" });
    if (await skipPlugins.isVisible()) {
      await skipPlugins.click();
    } else {
      await onboardingDialog.getByRole("button", { name: "Continue" }).last().click();
    }

    // Step 6: Layout — continue with the auto-selected provider-neutral blueprint.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await page.getByText("You're all set").isVisible()) break;
      await onboardingDialog.getByRole("button", { name: "Continue" }).last().click();
    }

    // Step 7: Complete
    await page.getByText("You're all set").waitFor({ state: "visible", timeout: 10_000 });
  }

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
