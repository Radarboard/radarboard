import { expect } from "@playwright/test";
import { test } from "../_helpers/fixtures";
import {
  assertNoOnboardingErrors,
  completeFirstRunOnboarding,
  enterDemoMode,
  getSettings,
} from "../_helpers/onboarding-helpers";

test.describe("demo mode flow @demo @onboarding", () => {
  test("demo badge visible in TopBar after entering demo mode", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await enterDemoMode(page, request);

    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Demo", { exact: true })).toBeVisible();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("settings panels show demo guard banner", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await enterDemoMode(page, request);

    await page
      .getByRole("navigation", { name: "Plugins" })
      .getByRole("button", { name: "Settings" })
      .click();
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await expect(settingsDialog).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Demo mode — this section is read-only")).toBeVisible();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("edit mode button disabled in demo", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await enterDemoMode(page, request);

    const editButton = page.getByLabel("Edit disabled in demo");
    await expect(editButton).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("demo badge popover shows connect and dismiss actions", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await enterDemoMode(page, request);

    await page.getByLabel("Demo mode active").click();
    await expect(page.getByText("Connect services")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Dismiss demo")).toBeVisible();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("demo badge → connect services → onboarding opens", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await enterDemoMode(page, request);

    await page.getByLabel("Demo mode active").click();
    await page.getByText("Connect services").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("demo badge → dismiss → demo mode cleared", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await enterDemoMode(page, request);

    await page.getByLabel("Demo mode active").click();
    await page.getByText("Dismiss demo").click();
    await expect(page.getByLabel("Demo mode active")).toBeHidden({ timeout: 5_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});

test.describe("onboarding persistence @onboarding @e2e-only", () => {
  test.skip(!process.env.RADARBOARD_E2E && !process.env.CI, "Requires E2E mode server");

  test("demo mode onboarding persists demoMode, layout, and widget map", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown> | undefined;
    const prefs = (widgetLayout?.preferences ?? {}) as Record<string, unknown>;

    expect(prefs.demoMode).toBe(true);
    expect(prefs.onboardingCompleted).toBe(true);

    const layouts = widgetLayout?.layouts as unknown[];
    expect(layouts?.length).toBeGreaterThan(0);
    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("normal mode onboarding persists without demoMode", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: false });

    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown> | undefined;
    const prefs = (widgetLayout?.preferences ?? {}) as Record<string, unknown>;

    expect(prefs.demoMode).toBe(false);
    expect(prefs.onboardingCompleted).toBe(true);

    const layouts = widgetLayout?.layouts as unknown[];
    expect(layouts?.length).toBeGreaterThan(0);
    await expect(page.getByLabel("Demo mode active")).toBeHidden({ timeout: 5_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("demo mode persists across page reload", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: 10_000 });
    await page.reload({ waitUntil: "commit" });
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("dismiss demo clears demoMode in persisted settings", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Demo mode active").click();
    await page.getByText("Dismiss demo").click();
    await expect(page.getByLabel("Demo mode active")).toBeHidden({ timeout: 5_000 });
    await page.waitForTimeout(1_000);

    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown> | undefined;
    const prefs = (widgetLayout?.preferences ?? {}) as Record<string, unknown>;

    expect(prefs.demoMode).toBe(false);

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("connect services from demo opens onboarding in returning mode", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    await expect(page.getByLabel("Demo mode active")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Demo mode active").click();
    await page.getByText("Connect services").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible();

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("onboarding persists projectLayouts with widget assignments", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown>;
    const projectLayouts = widgetLayout?.projectLayouts as Record<string, unknown>;

    // __all__ project layout must exist
    expect(projectLayouts).toHaveProperty("__all__");

    const allLayout = projectLayouts.__all__ as { pages?: Array<Record<string, unknown>> };
    expect(allLayout.pages).toBeDefined();
    expect(allLayout.pages!.length).toBeGreaterThan(0);

    // First page should have widgetLayouts with actual assignments
    const firstPage = allLayout.pages![0];
    expect(firstPage.name).toBe("Overview");
    expect(firstPage.widgetLayouts).toBeDefined();

    // At least one layout should have non-null widget assignments
    const layoutAssignments = Object.values(
      firstPage.widgetLayouts as Record<string, Record<string, string | null>>
    );
    const hasWidgets = layoutAssignments.some((assignments) =>
      Object.values(assignments).some((v) => v !== null)
    );
    expect(hasWidgets).toBe(true);

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("onboarding persists blueprintWidgetMap in preferences", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown>;
    const prefs = (widgetLayout?.preferences ?? {}) as Record<string, unknown>;

    // blueprintWidgetMap should be a non-empty object mapping cells to widgets
    const widgetMap = prefs.blueprintWidgetMap as Record<string, string> | undefined;
    expect(widgetMap).toBeDefined();
    expect(Object.keys(widgetMap!).length).toBeGreaterThan(0);

    // Values should be widget IDs (non-empty strings)
    for (const widgetId of Object.values(widgetMap!)) {
      expect(typeof widgetId).toBe("string");
      expect(widgetId.length).toBeGreaterThan(0);
    }

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("widgets from blueprint render on dashboard after onboarding", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: true });

    // Dashboard should be loaded
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });

    // At least one widget section should be visible on the dashboard.
    // Widget cards render as <section aria-label="Widget Title">.
    // The auto-selected blueprint always assigns at least one widget.
    const widgetSections = page.locator("section.widget-card");
    await expect(widgetSections.first()).toBeVisible({ timeout: 10_000 });

    // Verify widget has a heading (title bar)
    const firstWidgetTitle = widgetSections.first().locator("h2");
    await expect(firstWidgetTitle).toBeVisible();
    const titleText = await firstWidgetTitle.textContent();
    expect(titleText?.length).toBeGreaterThan(0);

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });

  test("normal mode onboarding also assigns widgets to dashboard", async ({
    page,
    request,
    consoleErrors,
    pageErrors,
  }) => {
    await completeFirstRunOnboarding(page, request, { demo: false });

    // Verify widget layout structure was persisted
    const settings = await getSettings(request);
    const widgetLayout = settings.widgetLayout as Record<string, unknown>;
    const projectLayouts = widgetLayout?.projectLayouts as Record<string, unknown>;

    expect(projectLayouts).toHaveProperty("__all__");

    const allLayout = projectLayouts.__all__ as { pages?: Array<Record<string, unknown>> };
    expect(allLayout.pages!.length).toBeGreaterThan(0);
    expect(allLayout.pages![0].widgetLayouts).toBeDefined();

    // Dashboard should show at least one widget
    await expect(page.getByRole("navigation", { name: "Plugins" })).toBeVisible({
      timeout: 20_000,
    });
    const widgetSections = page.locator("section.widget-card");
    await expect(widgetSections.first()).toBeVisible({ timeout: 10_000 });

    await assertNoOnboardingErrors(consoleErrors, pageErrors);
  });
});
