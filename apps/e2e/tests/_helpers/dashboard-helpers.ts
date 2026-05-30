import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { gotoDashboard, mockDashboardApis, primeDashboardRoute, resetE2EState } from "./fixtures";

// ---------------------------------------------------------------------------
// Timeout constants — single source of truth for CI-tunable values
// ---------------------------------------------------------------------------

export const TIMEOUT = {
  /** Full page load after navigation (heading visible) */
  pageLoad: 20_000,
  /** Dialog open / close transitions */
  dialog: 10_000,
  /** General element visibility */
  element: 5_000,
} as const;

// ---------------------------------------------------------------------------
// Dashboard setup
// ---------------------------------------------------------------------------

/**
 * Reset E2E state, mock APIs, prime the route, and navigate to the dashboard.
 * Combines the 4-call setup sequence used by most tests.
 */
export async function setupDashboard(
  page: Page,
  request: APIRequestContext,
  scenario: "fresh" | "dashboard" = "dashboard"
): Promise<void> {
  await resetE2EState(request, scenario);
  await mockDashboardApis(page);
  await primeDashboardRoute(request);
  await gotoDashboard(page);
}

/**
 * Assert the dashboard shell rendered with core elements.
 */
export async function assertDashboardLoaded(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Radarboard" })).toBeVisible({
    timeout: TIMEOUT.pageLoad,
  });
}

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------

/** Click the Settings dock button and return the visible dialog locator. */
export async function openSettings(page: Page): Promise<Locator> {
  await page
    .getByRole("navigation", { name: "Plugins" })
    .getByRole("button", { name: "Settings" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible({ timeout: TIMEOUT.dialog });
  return dialog;
}

/** Click a section button inside the settings dialog nav. */
export async function navigateSettingsSection(dialog: Locator, section: string): Promise<void> {
  await dialog.locator("nav").getByRole("button", { name: section, exact: true }).click();
}

/** Close the settings dialog and assert it is hidden. */
export async function closeSettings(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden({ timeout: TIMEOUT.element });
}

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

/** Select a time range option from the compact selector and assert it updates. */
export async function selectTimeRange(page: Page, range: string): Promise<void> {
  const trigger = page.getByLabel("Metric time range");
  await expect(trigger).toBeVisible({ timeout: TIMEOUT.dialog });
  await trigger.click();
  await page.getByRole("option", { name: range, exact: true }).click();
  await expect(trigger).toContainText(range);
}

// ---------------------------------------------------------------------------
// Command palette
// ---------------------------------------------------------------------------

/** Open the command palette and return the search input locator. */
export async function openCommandPalette(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Command palette" }).click();
  const input = page.getByPlaceholder("Search plugins, settings, actions...");
  await expect(input).toBeVisible({ timeout: TIMEOUT.element });
  return input;
}
