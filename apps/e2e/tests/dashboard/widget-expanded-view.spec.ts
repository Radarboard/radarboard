import { expect } from "@playwright/test";
import { setupDashboard, TIMEOUT } from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, test } from "../_helpers/fixtures";

test.describe("dashboard widget expanded view", () => {
  test("opens an expanded widget, syncs URL state, and preserves the selected size", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, request);

    await page.getByRole("button", { name: "Expand Revenue" }).click();

    const dialog = page.getByRole("dialog", { name: "Revenue" });
    await expect(dialog).toBeVisible({ timeout: TIMEOUT.dialog });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("expanded"), {
        timeout: TIMEOUT.dialog,
      })
      .toBe("revenue");

    await dialog.getByRole("button", { name: "Large" }).click();
    await expect(dialog.getByRole("button", { name: "Large" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: TIMEOUT.dialog });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("expanded"), {
        timeout: TIMEOUT.dialog,
      })
      .toBeNull();

    await page.getByRole("button", { name: "Expand Revenue" }).click();
    await expect(dialog).toBeVisible({ timeout: TIMEOUT.dialog });
    await expect(dialog.getByRole("button", { name: "Large" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.mouse.click(8, 8);
    await expect(dialog).toBeHidden({ timeout: TIMEOUT.dialog });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("expanded"), {
        timeout: TIMEOUT.dialog,
      })
      .toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
