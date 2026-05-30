import { expect } from "@playwright/test";
import {
  completeFirstRunOnboarding,
  getSettings,
  gotoDashboard,
  mockDashboardApis,
  primeDashboardRoute,
  resetE2EState,
} from "./fixtures";

export { completeFirstRunOnboarding, getSettings };

/** Known console warnings that are not regressions. */
const KNOWN_CONSOLE_WARNINGS = ["DialogContent", "DialogTitle"];

/** Assert no runtime errors, filtering known Radix accessibility warnings. */
export async function assertNoOnboardingErrors(consoleErrors: string[], pageErrors: string[]) {
  const filtered = consoleErrors.filter(
    (msg) => !KNOWN_CONSOLE_WARNINGS.some((warning) => msg.includes(warning))
  );
  expect.soft(filtered, `Console errors:\n${filtered.join("\n")}`).toEqual([]);
  expect.soft(pageErrors, `Page errors:\n${pageErrors.join("\n")}`).toEqual([]);
}

/**
 * Navigate to the onboarding wizard in preview mode (safe, no persistence).
 * Does NOT require E2E mode. Preview mode is URL-driven and doesn't modify state.
 */
export async function openPreviewOnboarding(page: Parameters<typeof gotoDashboard>[0]) {
  await mockDashboardApis(page);
  await gotoDashboard(page, "/?onboarding=preview");
}

/** Navigate to the first-run onboarding (fresh state, no DB config). */
export async function openFirstRunOnboarding(
  page: Parameters<typeof gotoDashboard>[0],
  request: Parameters<typeof resetE2EState>[0]
) {
  await resetE2EState(request, "fresh");
  await mockDashboardApis(page);
  await primeDashboardRoute(request);
  await gotoDashboard(page);
}

export async function enterDemoMode(page: Parameters<typeof gotoDashboard>[0]) {
  await openPreviewOnboarding(page);
  await page.getByText("Start with demo data").click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByText("You're all set").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("button", { name: "Go to Dashboard" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5_000 });
}

export const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  caret: "hide" as const,
  scale: "css" as const,
  timeout: 20_000,
};
