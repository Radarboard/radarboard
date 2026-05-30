import { expect } from "@playwright/test";
import { assertDashboardLoaded, setupDashboard, TIMEOUT } from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("widget connect CTA → service deep-link", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("unconfigured revenue widget shows Connect RevenueCat button", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    // Revenue widget should show the not-configured state with a connect CTA
    const revenueWidget = page.locator("section", { hasText: "Revenue" });
    await expect(revenueWidget).toBeVisible({ timeout: TIMEOUT.dialog });

    const connectButton = revenueWidget.getByRole("button", { name: /connect revenuecat/i });
    await expect(connectButton).toBeVisible({ timeout: TIMEOUT.element });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("clicking Connect opens Settings → Integrations with service modal", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    // Click the Connect button on the revenue widget
    const revenueWidget = page.locator("section", { hasText: "Revenue" });
    const connectButton = revenueWidget.getByRole("button", { name: /connect revenuecat/i });
    await expect(connectButton).toBeVisible({ timeout: TIMEOUT.element });
    await connectButton.click();

    // Settings dialog should open on integrations section
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    // The service detail modal should auto-open for RevenueCat
    await expect(page.getByText("RevenueCat", { exact: true })).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("?service= param is consumed after opening the service modal", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    // Click connect on revenue widget
    const revenueWidget = page.locator("section", { hasText: "Revenue" });
    await revenueWidget.getByRole("button", { name: /connect revenuecat/i }).click();

    // Wait for settings to open
    await page.getByRole("dialog", { name: "Settings" }).waitFor({
      state: "visible",
      timeout: TIMEOUT.dialog,
    });
    await page.waitForTimeout(2_000);

    // The ?service= param should be cleared from the URL
    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get("service")).toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
