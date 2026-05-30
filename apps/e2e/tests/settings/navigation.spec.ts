import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  closeSettings,
  navigateSettingsSection,
  openSettings,
  selectTimeRange,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, getSettings, resetE2EState, test } from "../_helpers/fixtures";

test.describe("settings navigation and persistence", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("can navigate through all settings sections", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);

    const sections = [
      "Projects",
      "Appearance",
      "Integrations",
      "Plugins",
      "Widgets",
      "Layouts",
      "Advanced",
    ];
    for (const section of sections) {
      await navigateSettingsSection(dialog, section);
      await page.waitForTimeout(300);
    }

    await navigateSettingsSection(dialog, "Database");
    await page.waitForTimeout(300);

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("settings dialog opens and closes cleanly", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await closeSettings(dialog);
    await assertDashboardLoaded(page);

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("time range selection works", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    await selectTimeRange(page, "7D");
    await selectTimeRange(page, "30D");
    await selectTimeRange(page, "1Y");

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("notification center opens and closes", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const notificationButton = page.getByRole("button", { name: /notifications/i });
    if (await notificationButton.isVisible({ timeout: TIMEOUT.element })) {
      await notificationButton.click();
      await page.waitForTimeout(500);
    }

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("settings API returns persisted data", async ({ request }) => {
    const settings = await getSettings(request);
    expect(settings).toBeDefined();
    expect(settings).toHaveProperty("widgetLayout");
  });

  test("database section shows current config", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Advanced");
    await navigateSettingsSection(dialog, "Database");
    await expect(dialog.getByText(/SQLite|PostgreSQL|database/i)).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
