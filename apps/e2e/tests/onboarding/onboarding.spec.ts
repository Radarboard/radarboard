import { expect } from "@playwright/test";
import { gotoDashboard, mockDashboardApis, test } from "../_helpers/fixtures";
import {
  assertNoOnboardingErrors,
  openFirstRunOnboarding,
  openPreviewOnboarding,
  SCREENSHOT_OPTS,
} from "../_helpers/onboarding-helpers";

test.describe.configure({ timeout: 90_000 });

// ---------------------------------------------------------------------------
// Preview mode — full walkthrough with screenshots at every step
// ---------------------------------------------------------------------------

test.describe("onboarding wizard — preview mode @onboarding", () => {
  test("step 1: welcome screen renders correctly", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Preview banner visible
    await expect(page.getByText("Preview mode")).toBeVisible({ timeout: 15_000 });

    // Welcome content
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible();
    await expect(page.getByText("Start with demo data")).toBeVisible();
    await expect(page.getByText("Start fresh")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeHidden();

    // Progress bar shows step labels
    await expect(page.getByRole("heading", { name: "Welcome to Radarboard" })).toBeVisible();

    // Screenshot
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("onboarding-step1-welcome.png", SCREENSHOT_OPTS);

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("step 2: about you — profile selection", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Start fresh advances into the profile-driven setup flow.
    await page.getByRole("button", { name: /^Start fresh/ }).click();

    // About You step visible
    await expect(page.getByText("Choose your primary role")).toBeVisible({ timeout: 10_000 });

    // Profile groups visible
    await expect(page.locator("div").filter({ hasText: /^Development$/ })).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^Product & Business$/ })).toBeVisible();

    // Screenshot before selection
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("onboarding-step2-profiles-empty.png", SCREENSHOT_OPTS);

    // Select a profile
    await page.getByText("Full-Stack Developer").click();

    // Verify selection state (checkmarks appear)
    await expect(dialog).toHaveScreenshot(
      "onboarding-step2-profiles-selected.png",
      SCREENSHOT_OPTS
    );

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("step 2 → step 4: profile selection treats provider suggestions as optional", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Advance to profile step
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await expect(page.getByText("Choose your primary role")).toBeVisible({ timeout: 10_000 });

    // Select "Open Source Maintainer"
    await page.getByText("Open Source Maintainer").click();

    // Continue to integrations (step 3 is DB, skipped in preview → goes to step 4)
    await page.getByRole("button", { name: "Continue" }).click();

    // Integrations step visible
    await expect(page.getByText("Select the services you use")).toBeVisible({ timeout: 10_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("You can connect services later")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /GitHub/i })).toBeVisible();

    // Screenshot
    await expect(dialog).toHaveScreenshot(
      "onboarding-step4-integrations-preselected.png",
      SCREENSHOT_OPTS
    );

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("step 5: plugins toggle", async ({ page, request, consoleErrors, pageErrors }) => {
    await openPreviewOnboarding(page);

    // Navigate: Welcome → Profile → Integrations → Plugins
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click(); // profile → integrations
    await page.getByRole("button", { name: "Continue" }).click(); // integrations are optional

    // Plugins step
    await expect(page.getByText("Choose which plugins to enable")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Productivity")).toBeVisible();
    await expect(page.getByText("Productivity")).toBeVisible();

    // Plugin toggles visible
    await expect(page.getByLabel("Tasks")).toBeVisible();
    await expect(page.getByLabel("Notes")).toBeVisible();

    // Screenshot
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("onboarding-step5-plugins.png", SCREENSHOT_OPTS);

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("step 6: layout selection", async ({ page, request, consoleErrors, pageErrors }) => {
    await openPreviewOnboarding(page);

    // Navigate: Welcome → Profile → skip Integrations/Plugins
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click(); // profile
    await page.getByRole("button", { name: "Continue" }).click(); // integrations
    await page.getByRole("button", { name: "Skip" }).click(); // plugins

    // Layout step — should show blueprint/layout options
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Screenshot
    await expect(dialog).toHaveScreenshot("onboarding-step6-layout.png", SCREENSHOT_OPTS);

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("step 7: complete — summary and finish", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Demo mode now jumps directly to completion.
    await page.getByRole("button", { name: /^Start with demo data/ }).click();

    // Complete step
    await expect(page.getByText("You're all set")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Demo mode")).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to Dashboard" })).toBeVisible();

    // Screenshot
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("onboarding-step7-complete.png", SCREENSHOT_OPTS);

    // Click finish — in preview mode, no persistence
    await page.getByRole("button", { name: "Go to Dashboard" }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Dashboard should be visible
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});

// ---------------------------------------------------------------------------
// Navigation — back, skip, dismiss
// ---------------------------------------------------------------------------

test.describe("onboarding wizard — navigation @onboarding", () => {
  test("back button navigates to previous step", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Welcome → Profile
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await expect(page.getByText("Choose your primary role")).toBeVisible({ timeout: 10_000 });

    // Profile → Integrations
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Select the services you use")).toBeVisible({ timeout: 10_000 });

    // Back → Profile
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText("Choose your primary role")).toBeVisible({ timeout: 10_000 });

    // Back → Welcome
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("skip buttons advance without requiring input", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Welcome → Profile → Integrations → continue → Plugins → skip → Layout → continue → Complete
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Select the services you use")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose which plugins to enable")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Skip" }).click(); // plugins → layout
    await page.getByRole("button", { name: "Continue" }).click(); // layout → complete
    await expect(page.getByText("You're all set")).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("preview mode dialog is dismissible via Escape", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    // Close via Escape; the onboarding dialog has no visible header close button.
    const dialog = page.getByRole("dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Dashboard visible after dismissal
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});

// ---------------------------------------------------------------------------
// First-run mode — real onboarding with fresh state
// ---------------------------------------------------------------------------

test.describe("onboarding wizard — first-run @onboarding @e2e-only", () => {
  // This test requires the app running in E2E mode (RADARBOARD_E2E=1) for state reset.
  // Skip when running against a regular dev server.
  test.skip(!process.env.RADARBOARD_E2E && !process.env.CI, "Requires E2E mode server");

  test("shows setup wizard for fresh state then onboarding after DB setup", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await openFirstRunOnboarding(page, request);

    // The existing SetupWizard appears first for database configuration
    await page.waitForResponse((r) => r.url().includes("/api/database/config"));
    const setupDialog = page.getByRole("dialog", { name: "Database Setup" });
    await expect(setupDialog).toBeVisible({ timeout: 15_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});

// ---------------------------------------------------------------------------
// Settings re-run — trigger wizard from settings sidebar
// ---------------------------------------------------------------------------

test.describe("onboarding wizard — settings re-run @onboarding", () => {
  test("re-run setup from settings opens wizard in returning mode", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await mockDashboardApis(page);
    await gotoDashboard(page);

    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });

    // Open settings
    await page
      .getByRole("navigation", { name: "Plugins" })
      .getByRole("button", { name: "Settings" })
      .click();
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible();

    // Click "Re-run Setup"
    await settingsDialog.getByRole("button", { name: "Re-run Setup" }).click();

    // Settings should close
    await expect(settingsDialog).toBeHidden({ timeout: 5_000 });

    // Onboarding wizard opens (no DB step in returning mode)
    const onboardingDialog = page.getByRole("dialog");
    await expect(onboardingDialog).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeHidden();

    // Database step should NOT appear — go through and verify
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await expect(page.getByText("Choose your primary role")).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("preview from settings opens wizard in preview mode", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await mockDashboardApis(page);
    await gotoDashboard(page);

    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });

    // Open settings
    await page
      .getByRole("navigation", { name: "Plugins" })
      .getByRole("button", { name: "Settings" })
      .click();
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible();

    // Click "Preview full onboarding"
    await settingsDialog.getByText("Preview full onboarding").click();

    // Settings should close, wizard opens with preview banner
    await expect(settingsDialog).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText("Preview mode")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeHidden();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});
