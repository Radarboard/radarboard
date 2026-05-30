import { expect } from "@playwright/test";
import {
  assertDashboardLoaded,
  openCommandPalette,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("settings URL state contract", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("appearance, notifications, shortcuts, and advanced subsections sync to the URL", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const appearanceUrl = new URL(page.url());
    appearanceUrl.searchParams.set("settings", "appearance");
    appearanceUrl.searchParams.set("appearanceSection", "ticker");
    await page.goto(appearanceUrl.toString(), { waitUntil: "domcontentloaded" });

    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    expect(new URL(page.url()).searchParams.get("appearanceSection")).toBe("ticker");

    await settingsDialog.getByRole("button", { name: "Display", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("appearanceSection")).toBe("display");

    const notificationsUrl = new URL(page.url());
    notificationsUrl.searchParams.set("settings", "notifications");
    notificationsUrl.searchParams.set("notificationsTab", "channels");
    await page.goto(notificationsUrl.toString(), { waitUntil: "domcontentloaded" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    expect(new URL(page.url()).searchParams.get("notificationsTab")).toBe("channels");

    await settingsDialog.getByRole("button", { name: "Rules", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("notificationsTab")).toBe("rules");

    const shortcutsUrl = new URL(page.url());
    shortcutsUrl.searchParams.set("settings", "shortcuts");
    shortcutsUrl.searchParams.set("shortcutScope", "plugins");
    await page.goto(shortcutsUrl.toString(), { waitUntil: "domcontentloaded" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    expect(new URL(page.url()).searchParams.get("shortcutScope")).toBe("plugins");

    await settingsDialog.getByRole("button", { name: "App", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("shortcutScope")).toBe("app");

    const advancedUrl = new URL(page.url());
    advancedUrl.searchParams.set("settings", "advanced");
    advancedUrl.searchParams.set("advancedSection", "database");
    await page.goto(advancedUrl.toString(), { waitUntil: "domcontentloaded" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    expect(new URL(page.url()).searchParams.get("advancedSection")).toBe("database");

    await settingsDialog.getByRole("button", { name: "Debug", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("advancedSection")).toBe("debug");

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("settings installer dialog and command palette are URL-addressable", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);
    await assertDashboardLoaded(page);

    const installerUrl = new URL(page.url());
    installerUrl.searchParams.set("settings", "plugins");
    installerUrl.searchParams.set("settingsInstaller", "plugins");
    await page.goto(installerUrl.toString(), { waitUntil: "domcontentloaded" });

    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: TIMEOUT.dialog });
    await expect(page.getByRole("heading", { name: "Install Extension" })).toBeVisible({
      timeout: TIMEOUT.dialog,
    });

    await page.getByRole("button", { name: "Close" }).last().click();
    expect(new URL(page.url()).searchParams.get("settingsInstaller")).toBeNull();

    await openCommandPalette(page);
    expect(new URL(page.url()).searchParams.get("launcher")).toBe("open");

    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Search plugins, settings, actions...")).toBeHidden({
      timeout: TIMEOUT.element,
    });
    expect(new URL(page.url()).searchParams.get("launcher")).toBeNull();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
