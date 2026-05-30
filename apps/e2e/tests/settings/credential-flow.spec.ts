import { expect } from "@playwright/test";
import {
  navigateSettingsSection,
  openSettings,
  setupDashboard,
  TIMEOUT,
} from "../_helpers/dashboard-helpers";
import { assertNoRuntimeErrors, resetE2EState, test } from "../_helpers/fixtures";

test.describe("integration credential flow", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request, "dashboard");
  });

  test("can open settings and navigate to integrations section", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Integrations");

    await expect(dialog.getByText("Integrations")).toBeVisible();
    await expect(dialog.getByPlaceholder("Search services...")).toBeVisible();

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("can open a service detail modal from the integrations panel", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Integrations");

    const githubCard = dialog.getByRole("button", { name: /Configure GitHub/i });
    if (await githubCard.isVisible({ timeout: TIMEOUT.element })) {
      await githubCard.click();
      await expect(page.getByText("Access")).toBeVisible({ timeout: TIMEOUT.element });
    }

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });

  test("credential API returns connected keys", async ({ request }) => {
    const response = await request.get("/api/credentials");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("connectedKeys");
    expect(Array.isArray(body.connectedKeys)).toBe(true);
  });

  test("credential API validates POST body", async ({ request }) => {
    const response = await request.post("/api/credentials", {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test("credential API saves and retrieves credentials", async ({ request }) => {
    const saveResponse = await request.post("/api/credentials", {
      data: {
        key: "e2e-test-service",
        values: { api_key: "test-key-123" },
      },
    });
    expect(saveResponse.status()).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody.success).toBe(true);

    const listResponse = await request.get("/api/credentials");
    const listBody = await listResponse.json();
    expect(listBody.connectedKeys).toContain("e2e-test-service");

    const getResponse = await request.get("/api/credentials?key=e2e-test-service");
    expect(getResponse.status()).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.key).toBe("e2e-test-service");
    expect(getBody.values).toHaveProperty("api_key");
  });

  test("credential API deletes credentials", async ({ request }) => {
    await request.post("/api/credentials", {
      data: {
        key: "e2e-delete-test",
        values: { token: "delete-me" },
      },
    });

    const deleteResponse = await request.delete("/api/credentials", {
      data: { key: "e2e-delete-test" },
    });
    expect(deleteResponse.status()).toBe(200);

    const listResponse = await request.get("/api/credentials");
    const listBody = await listResponse.json();
    expect(listBody.connectedKeys).not.toContain("e2e-delete-test");
  });

  test("search filters services in integrations panel", async ({
    page,
    consoleErrors,
    pageErrors,
  }) => {
    await setupDashboard(page, page.request);

    const dialog = await openSettings(page);
    await navigateSettingsSection(dialog, "Integrations");

    const searchInput = dialog.getByPlaceholder("Search services...");
    await expect(searchInput).toBeVisible({ timeout: TIMEOUT.element });
    await searchInput.fill("sentry");

    await expect(dialog.getByRole("button", { name: /Configure Sentry/i })).toBeVisible({
      timeout: TIMEOUT.element,
    });

    await assertNoRuntimeErrors(consoleErrors, pageErrors);
  });
});
