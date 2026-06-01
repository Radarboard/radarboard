import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  openCommandPalette,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import {
  assertNoRuntimeErrors,
  completeFirstRunOnboarding,
  resetE2EState,
  test,
} from "../_helpers/fixtures";

test.describe.configure({ timeout: 90_000 });

// ---------------------------------------------------------------------------
// Dashboard shell — basic rendering in different states
// ---------------------------------------------------------------------------

test.describe("dashboard data flows — seeded state", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("dashboard shell renders with all core elements", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    await expect(
      page.getByRole("navigation", { name: "Plugins" }).getByRole("button", { name: "Settings" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Command palette" })).toBeVisible();

    const timeRangeTrigger = page.getByLabel("Metric time range");
    await expect(timeRangeTrigger).toBeVisible();
    await expect(timeRangeTrigger).toContainText("30D");

    await expect(page.getByRole("button", { name: "All Projects" })).toBeVisible();

    const dock = page.getByRole("navigation", { name: "Plugins" });
    await expect(dock).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("project tabs are visible and clickable", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const allTab = page.getByRole("button", { name: "All Projects" });
    await expect(allTab).toBeVisible({ timeout: TIMEOUT.pageLoad });
    await allTab.click();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("time range selection changes active range", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const timeRangeTrigger = page.getByLabel("Metric time range");
    await expect(timeRangeTrigger).toBeVisible({ timeout: TIMEOUT.dialog });

    const ranges = ["TODAY", "7D", "30D", "1Y"];
    for (const range of ranges) {
      await timeRangeTrigger.click();
      await page.getByRole("option", { name: range, exact: true }).click();
      await expect(timeRangeTrigger).toContainText(range);

      const expectedRangeParam =
        range === "TODAY" ? "today" : range === "30D" ? null : range.toLowerCase();
      await expect
        .poll(() => new URL(page.url()).searchParams.get("range"))
        .toBe(expectedRangeParam);
    }

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("command palette search works", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const searchInput = await openCommandPalette(page);

    await searchInput.fill("settings");
    await expect(
      page
        .getByRole("button")
        .filter({ hasText: /settings/i })
        .first()
    ).toBeVisible({ timeout: TIMEOUT.element });

    await searchInput.clear();
    await searchInput.fill("tasks");
    await expect(page.getByRole("button").filter({ hasText: /tasks/i }).first()).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await page.keyboard.press("Escape");

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("database export API returns valid export", async ({ request }) => {
    const response = await request.get("/api/database/export");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("exportedAt");
    expect(body).toHaveProperty("provider");
    expect(body).toHaveProperty("settings");
  });
});

// ---------------------------------------------------------------------------
// Demo mode — widgets render demo data
// ---------------------------------------------------------------------------

test.describe("dashboard data flows — demo mode @e2e-only", () => {
  test.skip(!process.env.RADARBOARD_E2E && !process.env.CI, "Requires E2E mode server");

  test("demo mode dashboard shows demo badge and widgets", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: TIMEOUT.dialog });
    await assertDashboardLoaded(page);
    await expect(page.getByLabel("Edit disabled in demo")).toBeVisible();
    await expect(page.locator("section.widget-card")).toHaveCount(9, {
      timeout: TIMEOUT.element,
    });
    await expect(
      page.getByText(
        /not connected|not configured|Install an analytics provider extension|No sponsorship data available|No trend data/i
      )
    ).toHaveCount(0);

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("normal mode dashboard shows edit button (not disabled)", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: false });

    await expect(page.getByLabel("Demo mode active")).toBeHidden({ timeout: TIMEOUT.element });
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible({
      timeout: TIMEOUT.dialog,
    });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
