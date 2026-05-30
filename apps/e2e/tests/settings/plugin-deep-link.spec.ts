import { expect } from "@playwright/test";
import { assertDashboardLoaded, setupDashboard, TIMEOUT } from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("plugin deep-link from settings", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("navigating to ?settings=plugins&settingsPlugin=expenses opens the Expenses detail modal", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const url = new URL(page.url());
    url.searchParams.set("settings", "plugins");
    url.searchParams.set("settingsPlugin", "expenses");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    await expect(page.getByText("Expenses", { exact: true })).toBeVisible({
      timeout: TIMEOUT.element,
    });

    const openUrl = new URL(page.url());
    expect(openUrl.searchParams.get("settingsPlugin")).toBe("expenses");

    await page.getByRole("button", { name: "Close" }).last().click();

    const closedUrl = new URL(page.url());
    expect(closedUrl.searchParams.get("settingsPlugin")).toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("?settingsPluginTab= deep-links plugin detail tabs and clears on close", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const url = new URL(page.url());
    url.searchParams.set("settings", "plugins");
    url.searchParams.set("settingsPlugin", "expenses");
    url.searchParams.set("settingsPluginTab", "configuration");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    await expect(page.getByRole("tab", { name: "Configuration", exact: true })).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(new URL(page.url()).searchParams.get("settingsPluginTab")).toBe("configuration");

    await page.getByRole("tab", { name: "General", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("settingsPluginTab")).toBe("general");

    await page.getByRole("button", { name: "Close" }).last().click();
    const closedUrl = new URL(page.url());
    expect(closedUrl.searchParams.get("settingsPlugin")).toBeNull();
    expect(closedUrl.searchParams.get("settingsPluginTab")).toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
