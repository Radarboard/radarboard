import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  closeSettings,
  navigateSettingsSection,
  openCommandPalette,
  openSettings,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import {
  assertNoRuntimeErrors,
  mockDashboardApis,
  primeDashboardRoute,
  resetE2EState,
  test,
} from "../_helpers/fixtures";

test.describe("dashboard onboarding", () => {
  test("completes the first-run sqlite setup wizard", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await resetE2EState(request, "fresh");
    await mockDashboardApis(page);

    await primeDashboardRoute(request);
    await page.goto("/", { waitUntil: "commit", timeout: 15_000 });
    await page.waitForResponse((response) => response.url().includes("/api/database/config"));

    const setupDialog = page.getByRole("dialog", { name: "Database Setup" });
    await expect(setupDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("dialog", { name: "Configure SQLite" })).toBeVisible();

    await page.getByRole("button", { name: "Save & Continue" }).click();
    await expect(page.getByRole("dialog", { name: "Setup Complete" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Go to Dashboard" }).click();
    await expect(setupDialog).toBeHidden();
    await assertDashboardLoaded(page);

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});

test.describe("dashboard shell @smoke", () => {
  test("loads the dashboard shell, settings, project navigation, widget config, and command palette", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, request);
    await assertDashboardLoaded(page);

    await expect(
      page.getByRole("navigation", { name: "Plugins" }).getByRole("button", { name: "Settings" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All Projects" })).toBeVisible();

    const settingsDialog = await openSettings(page);

    const settingsChecks = [
      { section: "Projects", locator: settingsDialog.getByPlaceholder(/Search projects/i) },
      { section: "Widgets", locator: settingsDialog.getByPlaceholder(/Search widgets/i) },
      { section: "Integrations", locator: settingsDialog.getByPlaceholder(/Search services/i) },
      { section: "MCP Servers", locator: settingsDialog.getByPlaceholder(/Search servers/i) },
      { section: "Database", locator: settingsDialog.getByRole("button", { name: "Export Data" }) },
    ];

    for (const { section, locator } of settingsChecks) {
      await navigateSettingsSection(settingsDialog, section);
      await expect(locator).toBeVisible();
    }

    await navigateSettingsSection(settingsDialog, "Widgets");
    await expect(settingsDialog.getByRole("switch", { name: "Disable Revenue" })).toBeVisible();
    await expect(settingsDialog.getByRole("switch", { name: "Enable Sponsorship" })).toBeVisible();
    await expect(settingsDialog.getByText(/^1\/\d+ enabled$/)).toBeVisible();

    await closeSettings(settingsDialog);

    const searchInput = await openCommandPalette(page);
    await searchInput.fill("projects");
    await page
      .getByRole("button")
      .filter({ hasText: "Manage projects and environments" })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("opens notifications surfaces and top-bar controls from seeded dashboard", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, request);
    await assertDashboardLoaded(page);

    await page.getByRole("radio", { name: "30d" }).click();
    await expect(page.getByRole("radio", { name: "30d" })).toBeChecked();

    await page.getByRole("radio", { name: "CAD" }).click();
    await expect(page.getByRole("radio", { name: "CAD" })).toBeChecked();

    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
    await expect(page.getByText("No notifications yet.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /View all notifications/i }).click();
    const notificationsPanel = page.getByRole("dialog", { name: "Notifications panel" });
    await expect(notificationsPanel).toBeVisible();
    await expect(notificationsPanel.getByText("All caught up", { exact: true })).toBeVisible();
    await notificationsPanel
      .getByRole("button", { name: "Close notifications", exact: true })
      .click();
    await expect(notificationsPanel).toBeHidden();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
