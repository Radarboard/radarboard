import { expect } from "@playwright/test";
import { assertNoRuntimeErrors, gotoDashboard, test } from "../_helpers/fixtures";

test.describe("widget composition gallery @visual", () => {
  test("renders canonical recipe examples without runtime errors", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await gotoDashboard(page, "/debug/widget-composition");

    await expect(page.getByRole("heading", { name: "Canonical Recipe Examples" })).toBeVisible();

    const recipeKinds = [
      "summary_only",
      "summary_list",
      "content_only",
      "summary_chart_list",
      "rail_content",
      "rail_list",
      "summary_content",
    ] as const;

    for (const recipeKind of recipeKinds) {
      const example = page.getByTestId(`composition-example-${recipeKind}`);
      await expect(example).toBeVisible();
      await expect(example).toHaveScreenshot(`${recipeKind}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        timeout: 20_000,
      });
    }

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
