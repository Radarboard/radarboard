import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  navigateSettingsSection,
  openSettings,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import {
  assertNoRuntimeErrors,
  getSettings,
  gotoDashboard,
  mockDashboardApis,
  primeDashboardRoute,
  resetE2EState,
  test,
} from "../_helpers/fixtures";

const BASIC_4X4 = {
  id: "basic-4x4",
  name: "Basic 4×4",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 0, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 1, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-10", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-11", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-12", rowStart: 2, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-13", rowStart: 3, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-14", rowStart: 3, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-15", rowStart: 3, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-16", rowStart: 3, colStart: 3, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [25, 25, 25, 25],
  rowSizes: [25, 25, 25, 25],
};

test.describe("project layout keep-selection flow", () => {
  test("4x4 to 3x3 keeps every widget the user selected", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await resetE2EState(request, "dashboard");

    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown>;
    const projectLayouts = (widgetLayout.projectLayouts ?? {}) as Record<
      string,
      { pages?: Array<Record<string, unknown>> }
    >;
    const allProjects = projectLayouts.__all__;
    const overviewPage = allProjects?.pages?.[0];

    if (!allProjects || !overviewPage) {
      throw new Error("Expected seeded All Projects overview page in E2E settings");
    }

    const fourByFourAssignments = Object.fromEntries(
      BASIC_4X4.cells.map((cell) => [cell.id, null as string | null])
    );
    fourByFourAssignments["cell-1"] = "revenue";
    fourByFourAssignments["cell-2"] = "analytics";
    fourByFourAssignments["cell-3"] = "shipping";
    fourByFourAssignments["cell-4"] = "observability";
    fourByFourAssignments["cell-5"] = "pulls";
    fourByFourAssignments["cell-6"] = "stars";
    fourByFourAssignments["cell-7"] = "deployments";
    fourByFourAssignments["cell-8"] = "domains";
    fourByFourAssignments["cell-12"] = "downloads";
    fourByFourAssignments["cell-16"] = "seo";

    const response = await request.post("/api/settings", {
      data: {
        widgetLayout: {
          ...widgetLayout,
          layouts: [...((widgetLayout.layouts ?? []) as unknown[]).filter(Boolean), BASIC_4X4],
          projectLayouts: {
            ...projectLayouts,
            __all__: {
              ...allProjects,
              pages: [
                {
                  ...overviewPage,
                  layoutId: BASIC_4X4.id,
                  widgetLayouts: {
                    ...((overviewPage.widgetLayouts as Record<
                      string,
                      Record<string, string | null>
                    > | null) ?? {}),
                    [BASIC_4X4.id]: fourByFourAssignments,
                  },
                },
              ],
            },
          },
        },
      },
    });

    expect(response.ok()).toBeTruthy();

    await mockDashboardApis(page);
    await primeDashboardRoute(request);
    await gotoDashboard(page);
    await assertDashboardLoaded(page);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Projects");

    await expect(dialog.getByText("Aggregate dashboard view across every project.")).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await dialog.getByLabel("Page layout").click();
    await page.getByRole("option", { name: "Basic 3×3" }).first().click();

    const keepDialog = page.getByRole("dialog", { name: "Choose Widgets to Keep" });
    await expect(keepDialog).toBeVisible({ timeout: TIMEOUT.dialog });

    const keepLabels = keepDialog.locator("label");
    const keepLabelCount = await keepLabels.count();

    for (let index = 0; index < keepLabelCount; index += 1) {
      const label = keepLabels.nth(index);
      const text = await label.innerText();
      if (text.includes("NPM Downloads") || text.includes("SEO Performance")) {
        continue;
      }
      await label.click();
    }

    const downloadsLabel = keepDialog.locator("label").filter({ hasText: "NPM Downloads" });
    const downloadsCheckbox = downloadsLabel.locator('input[type="checkbox"]');
    if (!(await downloadsCheckbox.isChecked())) {
      await downloadsLabel.click();
    }

    const seoLabel = keepDialog.locator("label").filter({ hasText: "SEO Performance" });
    const seoCheckbox = seoLabel.locator('input[type="checkbox"]');
    if (!(await seoCheckbox.isChecked())) {
      await seoLabel.click();
    }

    await expect(keepDialog.getByText("Keeping 2 of 9")).toBeVisible({ timeout: TIMEOUT.element });

    const saveResponse = page.waitForResponse(
      (res) => res.url().includes("/api/settings") && res.request().method() === "POST" && res.ok()
    );
    await keepDialog.getByRole("button", { name: "Apply Layout" }).click();
    await saveResponse;
    await expect(keepDialog).toBeHidden({ timeout: TIMEOUT.dialog });

    const updatedSettings = await getSettings(request);
    const updatedWidgetLayout = updatedSettings.widgetLayout as {
      projectLayouts?: Record<
        string,
        {
          pages?: Array<{
            layoutId?: string;
            widgetLayouts?: Record<string, Record<string, string | null>>;
          }>;
        }
      >;
    };
    const nextAssignments =
      updatedWidgetLayout.projectLayouts?.__all__?.pages?.[0]?.widgetLayouts?.["basic-3x3"];

    expect(updatedWidgetLayout.projectLayouts?.__all__?.pages?.[0]?.layoutId).toBe("basic-3x3");
    expect(Object.values(nextAssignments ?? {}).filter((widgetId) => widgetId !== null)).toEqual([
      "downloads",
      "seo",
    ]);

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
