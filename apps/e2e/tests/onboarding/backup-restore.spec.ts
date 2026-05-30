import { expect } from "@playwright/test";
import { test } from "../_helpers/fixtures";
import { assertNoOnboardingErrors, openPreviewOnboarding } from "../_helpers/onboarding-helpers";

/** Minimal valid v1 config backup for testing the restore flow. */
const VALID_BACKUP = JSON.stringify({
  version: "1",
  exportedAt: new Date().toISOString(),
  projectOrder: ["restored-project"],
  widgetLayout: {
    configs: {},
    layouts: [
      {
        id: "basic-3x3",
        name: "Basic 3×3",
        cells: [
          { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
          { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        ],
        colSizes: [50, 50],
        rowSizes: [100],
      },
    ],
    projectLayouts: {},
    preferences: { timezone: "America/New_York", polling: {} },
  },
  featurePreferences: {},
});

const INVALID_JSON = "{ not valid json !!!";
const WRONG_VERSION = JSON.stringify({ version: "99", projectOrder: [] });

// ---------------------------------------------------------------------------
// Preview mode — restore UI without persistence
// ---------------------------------------------------------------------------

test.describe("onboarding backup restore — preview mode @onboarding", () => {
  test("welcome step shows restore from backup option", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Restore from backup")).toBeVisible();
    await expect(
      page.getByText(
        "Upload a config backup to restore your layouts, preferences, and plugin settings."
      )
    ).toBeVisible();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("restore button triggers file picker", async ({ page, consoleErrors, pageErrors }) => {
    await openPreviewOnboarding(page);
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    // The file input is hidden — verify it exists
    const fileInput = page.locator('input[type="file"][accept*=".json"]');
    await expect(fileInput).toBeAttached();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("invalid JSON file shows error message", async ({ page, consoleErrors, pageErrors }) => {
    await openPreviewOnboarding(page);
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    // Upload invalid JSON via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(INVALID_JSON),
    });

    // Error message should appear
    await expect(page.getByText(/Invalid backup file/i)).toBeVisible({ timeout: 5_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("wrong version backup shows error message", async ({ page, consoleErrors, pageErrors }) => {
    await openPreviewOnboarding(page);
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(WRONG_VERSION),
    });

    // Should show an error (validation fails for version != "1")
    await expect(page.getByText(/Invalid backup file|Failed to restore/i)).toBeVisible({
      timeout: 5_000,
    });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});

// ---------------------------------------------------------------------------
// E2E mode — restore with persistence
// ---------------------------------------------------------------------------

test.describe("onboarding backup restore — persistence @onboarding @e2e-only", () => {
  test.skip(!process.env.RADARBOARD_E2E && !process.env.CI, "Requires E2E mode server");

  test("valid backup restores and advances to next step", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(VALID_BACKUP),
    });

    // Should advance past the welcome step (restore triggers onNext)
    await expect(page.getByText("Select all that apply")).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("restored backup skips layout application on finish", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    // Upload valid backup
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(VALID_BACKUP),
    });

    // Advance should happen automatically
    await expect(page.getByText("Select all that apply")).toBeVisible({ timeout: 10_000 });

    // Skip through remaining steps to complete
    await page.getByRole("button", { name: "Skip" }).click(); // profile → integrations
    await page.getByRole("button", { name: "Skip" }).click(); // integrations → plugins
    await page.getByRole("button", { name: "Skip" }).click(); // plugins → layout
    await page.getByRole("button", { name: "Skip" }).click(); // layout → complete

    // Complete step should show
    await expect(page.getByText("You're all set")).toBeVisible({ timeout: 10_000 });

    // Finish onboarding
    await page.getByRole("button", { name: "Go to Dashboard" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5_000 });

    // Dashboard should be visible
    await expect(page.getByRole("heading", { name: "Radarboard" })).toBeVisible({
      timeout: 20_000,
    });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("config import API accepts valid backup directly", async ({ request }) => {
    const response = await request.post("/api/config/import", {
      data: JSON.parse(VALID_BACKUP),
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.applied).toBeDefined();
  });

  test("config import API rejects invalid version", async ({ request }) => {
    const response = await request.post("/api/config/import", {
      data: { version: "99" },
    });
    expect(response.status()).toBe(400);
  });

  test("config import API rejects empty body", async ({ request }) => {
    const response = await request.post("/api/config/import", {
      data: {},
    });
    expect(response.status()).toBe(400);
  });
});
