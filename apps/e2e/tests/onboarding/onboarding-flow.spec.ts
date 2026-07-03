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
// Layout step: defaults to Templates, with nothing pre-selected
// ---------------------------------------------------------------------------

test.describe("onboarding flow — Layout step defaults @onboarding", () => {
  test("Layout step defaults to the Templates tab with nothing pre-selected", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
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
    await expect(page.getByText("Dashboard Layout")).toBeVisible({ timeout: TIMEOUT.dialog });

    // The Templates tab is the default surface — a template card is shown,
    // and the Blueprints tab remains available to switch to.
    await expect(page.getByRole("button", { name: /Basic 3x3/i })).toBeVisible({
      timeout: TIMEOUT.element,
    });
    await expect(page.getByRole("button", { name: "blueprints" })).toBeVisible();

    // Nothing is pre-selected, so the action button reads "Skip" (not "Continue")
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("selecting a template keeps the user on the step until Continue is clicked", async ({
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

    // Templates is the default tab — pick a template (an empty grid).
    await page.getByRole("button", { name: /Basic 3x3/i }).click();

    await expect(page.getByText("Dashboard Layout")).toBeVisible({ timeout: TIMEOUT.element });
    await expect(page.getByText("You're all set")).toBeHidden();

    // Selecting a layout flips the action button to "Continue".
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("You're all set")).toBeVisible({ timeout: TIMEOUT.dialog });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});
