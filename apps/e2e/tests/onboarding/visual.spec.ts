import { expect } from "@playwright/test";
import { test } from "../_helpers/fixtures";
import { openPreviewOnboarding, SCREENSHOT_OPTS } from "../_helpers/onboarding-helpers";

test.describe("onboarding wizard — visual regression @onboarding @visual", () => {
  test("welcome step responsive layout", async ({ page }) => {
    await openPreviewOnboarding(page);
    await expect(page.getByText("Welcome to Radarboard")).toBeVisible({ timeout: 15_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("responsive-welcome.png", SCREENSHOT_OPTS);
  });

  test("profile step responsive layout", async ({ page }) => {
    await openPreviewOnboarding(page);
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await expect(page.getByText("Choose your primary role")).toBeVisible({ timeout: 10_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("responsive-profile.png", SCREENSHOT_OPTS);
  });

  test("integrations step responsive layout", async ({ page }) => {
    await openPreviewOnboarding(page);
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Select the services you use")).toBeVisible({ timeout: 10_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("responsive-integrations.png", SCREENSHOT_OPTS);
  });

  test("plugins step responsive layout", async ({ page }) => {
    await openPreviewOnboarding(page);
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose which plugins to enable")).toBeVisible({ timeout: 10_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("responsive-plugins.png", SCREENSHOT_OPTS);
  });

  test("layout step responsive layout", async ({ page }) => {
    await openPreviewOnboarding(page);
    await page.getByRole("button", { name: /^Start fresh/ }).click();
    await page.getByText("Full-Stack Developer").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveScreenshot("responsive-layout.png", SCREENSHOT_OPTS);
  });

  test("complete step responsive layout", async ({ page }) => {
    await openPreviewOnboarding(page);
    await page.getByRole("button", { name: /^Start with demo data/ }).click();
    await expect(page.getByText("You're all set")).toBeVisible({ timeout: 10_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveScreenshot("responsive-complete.png", SCREENSHOT_OPTS);
  });
});
