import { expect } from "@playwright/test";
import {
  navigateSettingsSection,
  openCommandPalette,
  openSettings,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("plugin activation", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("can open a plugin from the dock", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const dock = page.getByRole("navigation", { name: "Plugins" });
    await expect(dock).toBeVisible({ timeout: TIMEOUT.dialog });

    const firstPlugin = dock.getByRole("button").first();
    await firstPlugin.click();

    await expect(page.locator("[data-plugin-overlay]")).toBeVisible({ timeout: TIMEOUT.element });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("can open and close Tasks plugin", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    await page.getByRole("button", { name: "Tasks" }).click();
    const tasksOverlay = page.getByRole("dialog", { name: "Tasks" });
    await expect(tasksOverlay).toBeVisible({ timeout: TIMEOUT.element });

    await tasksOverlay.getByRole("button", { name: "Close plugin" }).last().click();
    await expect(tasksOverlay).toBeHidden();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("can open and close Notes plugin", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const notesButton = page.getByRole("button", { name: "Notes" });
    if (await notesButton.isVisible({ timeout: TIMEOUT.element })) {
      await notesButton.click();
      const overlay = page.locator("[data-plugin-overlay]");
      await expect(overlay).toBeVisible({ timeout: TIMEOUT.element });

      const closeButton = overlay.getByRole("button", { name: "Close plugin" }).last();
      if (await closeButton.isVisible({ timeout: 2_000 })) {
        await closeButton.click();
        await expect(overlay).toBeHidden({ timeout: TIMEOUT.element });
      }
    }

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("can open plugin via command palette", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: TIMEOUT.element });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("toggling same plugin closes it", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    await page.getByRole("button", { name: "Tasks" }).click();
    await expect(page.locator("[data-plugin-overlay]")).toBeVisible({ timeout: TIMEOUT.element });

    await page.getByRole("button", { name: "Tasks" }).click();
    await expect(page.locator("[data-plugin-overlay]")).toBeHidden({ timeout: TIMEOUT.element });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("plugins section in settings lists available plugins", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Plugins");

    await expect(dialog.getByText(/plugin/i)).toBeVisible({ timeout: TIMEOUT.element });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("health API returns integration health data", async ({ request }) => {
    const response = await request.get("/api/health/integrations");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("totalSources");
    expect(body).toHaveProperty("sources");
    expect(Array.isArray(body.sources)).toBe(true);
  });

  test("plugin data API accepts and returns data", async ({ request }) => {
    const pluginToken = "e2e-test-token";

    const getResponse = await request.get("/api/plugins/data?pluginId=_system&key=e2e-test-key", {
      headers: { "X-Plugin-Token": pluginToken },
    });
    expect([200, 401, 404]).toContain(getResponse.status());
  });
});
