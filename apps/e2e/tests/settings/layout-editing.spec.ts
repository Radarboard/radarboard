import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  navigateSettingsSection,
  openSettings,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, getSettings, resetE2EState, test } from "../_helpers/fixtures";

test.describe("layout editing flow", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("edit mode toggles on and off", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const editButton = page.getByRole("button", { name: "Edit layout" });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT.pageLoad });

    await editButton.click();
    await expect(page.getByRole("button", { name: "Exit edit mode" })).toBeVisible();

    await page.getByRole("button", { name: "Exit edit mode" }).click();
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("edit mode is transient — does not persist after reload", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const editButton = page.getByRole("button", { name: "Edit layout" });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT.pageLoad });
    await editButton.click();
    await expect(page.getByRole("button", { name: "Exit edit mode" })).toBeVisible();

    await page.reload({ waitUntil: "commit" });
    await assertDashboardLoaded(page);

    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("layouts section in settings shows layout options", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Layouts");

    await expect(dialog.getByText(/layout/i)).toBeVisible({ timeout: TIMEOUT.element });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("widget layout persists via API", async ({ request }) => {
    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown> | undefined;

    expect(widgetLayout).toBeDefined();
    const layouts = widgetLayout?.layouts as unknown[];
    expect(layouts).toBeDefined();
  });
});
