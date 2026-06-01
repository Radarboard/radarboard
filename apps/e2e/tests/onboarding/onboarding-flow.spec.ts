import { expect } from "@playwright/test";
import { TIMEOUT } from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, test } from "../_helpers/fixtures";
import {
  assertNoOnboardingErrors,
  enterDemoMode,
  openPreviewOnboarding,
} from "../_helpers/onboarding-helpers";

test.describe.configure({ timeout: 90_000 });

// ---------------------------------------------------------------------------
// Bug fix: About You step — Continue button gating
// ---------------------------------------------------------------------------

test.describe("onboarding flow — About You step @onboarding", () => {
  test("Continue button is disabled without profile selection", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    // Welcome step — advance to About You
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await expect(page.getByText("Choose your primary role")).toBeVisible({
      timeout: TIMEOUT.dialog,
    });

    // Continue button should be disabled when no profile is selected
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeVisible({ timeout: TIMEOUT.element });
    await expect(continueButton).toBeDisabled();

    // Select a profile
    await page.getByText("Full-Stack Developer").click();

    // Continue button should now be enabled
    await expect(continueButton).toBeEnabled();

    // Click Continue and verify navigation to the next step (Integrations)
    await continueButton.click();
    await expect(page.getByText("Select the services you use")).toBeVisible({
      timeout: TIMEOUT.dialog,
    });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});

// ---------------------------------------------------------------------------
// Bug fix: Demo mode does not auto-trigger onboarding on page load
// ---------------------------------------------------------------------------

test.describe("onboarding flow — demo mode no auto-trigger @onboarding @demo", () => {
  test("demo mode does not auto-trigger onboarding on page load", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    // Complete onboarding with demo mode to set up the dashboard state
    await enterDemoMode(page, request);

    // Dashboard should be visible (enterDemoMode already asserts dialog is hidden)
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: TIMEOUT.pageLoad,
    });

    // Reload the page — onboarding should NOT reappear
    await page.reload({ waitUntil: "commit" });

    // Dashboard should load without the onboarding dialog
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: TIMEOUT.pageLoad,
    });

    // Onboarding dialog should NOT be visible
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeHidden({ timeout: TIMEOUT.element });

    // Verify dashboard widgets are present (at least one widget section)
    const widgetSections = page.locator("section.widget-card");
    await expect(widgetSections.first()).toBeVisible({ timeout: TIMEOUT.dialog });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});

// ---------------------------------------------------------------------------
// Bug fix: Layout step pre-selects a blueprint
// ---------------------------------------------------------------------------

test.describe("onboarding flow — Layout step blueprint pre-selection @onboarding", () => {
  test("Layout step pre-selects a blueprint", async ({ page, consoleErrors, pageErrors }) => {
    await openPreviewOnboarding(page);

    // Navigate: Welcome -> Profile -> Integrations (continue) -> Plugins (skip) -> Layout
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click(); // profile
    await page.getByRole("button", { name: "Continue" }).click(); // integrations
    await page.getByRole("button", { name: "Skip" }).click(); // plugins

    // Layout step should be visible
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: TIMEOUT.dialog });

    // A blueprint card should have the selected visual indicator (ring highlight)
    // The pre-selected blueprint gets a ring-2 ring-accent/40 class
    const selectedBlueprint = dialog.locator("[class*='ring-2']");
    await expect(selectedBlueprint.first()).toBeVisible({ timeout: TIMEOUT.element });

    // The action button should say "Continue" (not "Skip") because a blueprint is pre-selected
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeVisible({ timeout: TIMEOUT.element });
    await expect(continueButton).toBeEnabled();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("selecting a layout keeps the user on the step until Continue is clicked", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await openPreviewOnboarding(page);

    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click(); // profile
    await page.getByRole("button", { name: "Continue" }).click(); // integrations
    await page.getByRole("button", { name: "Skip" }).click(); // plugins

    await expect(page.getByText("Dashboard Layout")).toBeVisible({ timeout: TIMEOUT.dialog });

    await page.getByRole("button", { name: /growth dashboard/i }).click();

    await expect(page.getByText("Dashboard Layout")).toBeVisible({ timeout: TIMEOUT.element });
    await expect(page.getByText("You're all set")).toBeHidden();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("You're all set")).toBeVisible({ timeout: TIMEOUT.dialog });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});
