import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  closeSettings,
  openCommandPalette,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, test } from "../_helpers/fixtures";

test.describe("dashboard interactions", () => {
  test("toggles edit mode and opens plugin overlay", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, request);

    const editButton = page.getByRole("button", { name: "Edit layout" });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT.pageLoad });
    await editButton.click();
    await expect(page.getByRole("button", { name: "Exit edit mode" })).toBeVisible();

    await page.getByRole("button", { name: "Tasks" }).click();
    const tasksOverlay = page.getByRole("dialog", { name: "Tasks" });
    await expect(tasksOverlay).toBeVisible();
    await tasksOverlay.getByRole("button", { name: "Close plugin" }).last().click();
    await expect(tasksOverlay).toBeHidden();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("opens command palette actions without leaving the dashboard", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, request);
    await assertDashboardLoaded(page);

    const searchInput = await openCommandPalette(page);
    await searchInput.fill("open settings");
    await page.getByRole("button").filter({ hasText: "Open Settings" }).first().click();

    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible();
    await closeSettings(settingsDialog);

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
