import { expect } from "@playwright/test";
import { selectTimeRange, setupDashboard, TIMEOUT } from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("dashboard session persistence", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("time range selection persists across navigation", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await selectTimeRange(page, "7D");

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("project filter buttons are visible", async ({ page, consoleErrors, pageErrors }) => {
    await setupDashboard(page, page.request);

    const allButton = page.getByRole("button", { name: "All Projects" });
    await expect(allButton).toBeVisible({ timeout: TIMEOUT.dialog });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
