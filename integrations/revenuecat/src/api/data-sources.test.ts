import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { describe, expect, it, vi } from "vitest";
import { revenuecatDataSource } from "./data-sources";

const stubParams: { currency: "USD" | "CAD" | "EUR" | "GBP" | "JPY" } & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
  currency: "USD",
};

function stubCtx(
  resolveValue: Record<string, string> | null,
  projects: Array<Record<string, unknown>>
): DataSourceContext {
  return {
    resolveCredential: vi.fn().mockResolvedValue(resolveValue),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue(projects),
  };
}

describe("revenuecat data source", () => {
  it("returns project setup state when credentials exist but no project is linked", async () => {
    const ctx = stubCtx({ apiKey: "rc-key" }, [
      {
        slug: "radarboard",
        name: "Radarboard",
        color: "#111",
        platforms: [{ id: "ios", name: "iOS", integrations: {} }],
      },
    ]);

    await expect(revenuecatDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      ctaLabel: "Open Project Settings",
      ctaTarget: "intent:revenuecat-project",
      projectMappingRequired: true,
      setupMessage:
        "RevenueCat is connected, but no project is linked yet. Add a RevenueCat project ID in Project Settings.",
    });
  });

  it("returns configured false when credentials are missing", async () => {
    const ctx = stubCtx(null, []);

    await expect(revenuecatDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });
});
