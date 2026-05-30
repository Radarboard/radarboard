import { expect } from "@playwright/test";
import {
  assertNoRuntimeErrors,
  gotoDashboard,
  mockDashboardApis,
  primeDashboardRoute,
  test,
} from "../_helpers/fixtures";

test.describe("plugin deep linking", () => {
  test("clicking a changelog row opens the modal with the correct entry", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    // await resetE2EState(request, "dashboard");
    await mockDashboardApis(page);

    // Mock changelog data
    await page.route("**/api/plugins/data?pluginId=changelog&key=changelog:list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          value: JSON.stringify([
            {
              id: "entry-1",
              packageName: "test-package",
              version: "1.0.0",
              date: "2026-03-20",
              publishedAt: "2026-03-20T10:00:00Z",
              title: "Test Entry 1",
              notesQuality: "full",
              sourceType: "github_release",
              projectSlugs: ["radarboard"],
              watchIds: ["watch-1"],
            },
            {
              id: "entry-2",
              packageName: "other-package",
              version: "2.0.0",
              date: "2026-03-21",
              publishedAt: "2026-03-21T10:00:00Z",
              title: "Test Entry 2",
              notesQuality: "minimal",
              sourceType: "npm_publish",
              projectSlugs: ["radarboard"],
              watchIds: ["watch-2"],
            },
          ]),
        }),
      });
    });

    await primeDashboardRoute(request);
    await gotoDashboard(page);

    // Wait for the Timeline widget to be visible
    const timelineWidget = page.locator('[data-widget-id="changelog__timeline"]');
    await expect(timelineWidget).toBeVisible({ timeout: 20_000 });

    // Click the second entry ("other-package")
    const secondRow = timelineWidget.getByText("other-package").first();
    await secondRow.click();

    // Verify the modal is open
    const changelogOverlay = page.getByRole("dialog", { name: "Changelog" });
    await expect(changelogOverlay).toBeVisible();

    // Verify the correct entry is selected in the detail view
    await expect(changelogOverlay.locator("h1")).toContainText("Test Entry 2");
    await expect(changelogOverlay.getByText("v2.0.0")).toBeVisible();

    // Now click the first row while modal is open
    const firstRow = timelineWidget.getByText("test-package").first();
    await firstRow.click();

    // Verify the selection changed without modal closing/reopening
    await expect(changelogOverlay.locator("h1")).toContainText("Test Entry 1");
    await expect(changelogOverlay.getByText("v1.0.0")).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("clicking a note row opens the modal with the correct note", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    // await resetE2EState(request, "dashboard");
    await mockDashboardApis(page);

    // Mock notes data
    await page.route("**/api/plugins/data?pluginId=notes&key=notes:list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          value: JSON.stringify([
            {
              id: "note-1",
              title: "Deep Link Note 1",
              content: "Content 1",
              updatedAt: new Date().toISOString(),
              folderId: "root",
            },
            {
              id: "note-2",
              title: "Deep Link Note 2",
              content: "Content 2",
              updatedAt: new Date().toISOString(),
              folderId: "root",
            },
          ]),
        }),
      });
    });

    await primeDashboardRoute(request);
    await gotoDashboard(page);

    // Wait for the Recent Notes widget
    const notesWidget = page.locator('[data-widget-id="notes__recent"]');
    await expect(notesWidget).toBeVisible({ timeout: 20_000 });

    // Click the first note
    await notesWidget.getByText("Deep Link Note 1").click();

    // Verify modal and correct note
    const notesOverlay = page.getByRole("dialog", { name: "Notes" });
    await expect(notesOverlay).toBeVisible();
    await expect(notesOverlay.locator("input[placeholder='Note title...']")).toHaveValue(
      "Deep Link Note 1"
    );

    // Click the second note
    await notesWidget.getByText("Deep Link Note 2").click();

    // Verify switch
    await expect(notesOverlay.locator("input[placeholder='Note title...']")).toHaveValue(
      "Deep Link Note 2"
    );

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
