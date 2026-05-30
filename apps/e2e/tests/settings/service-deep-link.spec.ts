import { expect } from "@playwright/test";
import { assertDashboardLoaded, setupDashboard, TIMEOUT } from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("service deep-link from widget connect", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("navigating to ?settings=integrations&service=github opens the GitHub detail modal", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    // Navigate with deep-link params
    const url = new URL(page.url());
    url.searchParams.set("settings", "integrations");
    url.searchParams.set("service", "github");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    // Settings dialog should be open on integrations
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    // The GitHub service detail modal should auto-open
    await expect(page.getByText("GitHub", { exact: true })).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("?service= param remains in the URL while the modal is open and clears on close", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const url = new URL(page.url());
    url.searchParams.set("settings", "integrations");
    url.searchParams.set("service", "sentry");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    // Modal should open
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    const openUrl = new URL(page.url());
    expect(openUrl.searchParams.get("service")).toBe("sentry");

    await page.getByRole("button", { name: "Close" }).last().click();

    const closedUrl = new URL(page.url());
    expect(closedUrl.searchParams.get("service")).toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("?integrationTab= deep-links to the service detail tab and updates on tab change", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const url = new URL(page.url());
    url.searchParams.set("settings", "integrations");
    url.searchParams.set("service", "github");
    url.searchParams.set("integrationTab", "events");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    const eventsTab = page.getByRole("button", { name: "Events", exact: true });
    await expect(eventsTab).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).searchParams.get("integrationTab")).toBe("events");

    await page.getByRole("button", { name: "Access", exact: true }).click();
    await expect(page.getByRole("button", { name: "Access", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(new URL(page.url()).searchParams.get("integrationTab")).toBe("access");

    await page.getByRole("button", { name: "Close" }).last().click();
    const closedUrl = new URL(page.url());
    expect(closedUrl.searchParams.get("service")).toBeNull();
    expect(closedUrl.searchParams.get("integrationTab")).toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("unknown service ID in ?service= param does not crash", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const url = new URL(page.url());
    url.searchParams.set("settings", "integrations");
    url.searchParams.set("service", "nonexistent-service-xyz");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    // Settings should still be open, no crash
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    // Search input should still be functional
    await expect(settingsDialog.getByPlaceholder("Search services...")).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
