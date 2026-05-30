import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { describe, expect, it, vi } from "vitest";
import { appStoreConnectDataSource } from "./data-sources";

const stubParams: Record<string, unknown> & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
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

describe("app store connect data source", () => {
  it("returns project setup state when credentials exist but no app is linked", async () => {
    const ctx = stubCtx({ keyId: "kid", issuerId: "issuer", privateKey: "p8" }, [
      {
        slug: "radarboard",
        name: "Radarboard",
        color: "#111",
        platforms: [{ id: "ios", name: "iOS", integrations: {} }],
      },
    ]);

    await expect(appStoreConnectDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      ctaLabel: "Open Project Settings",
      ctaTarget: "intent:app-store-connect-project",
      projectMappingRequired: true,
      setupMessage:
        "App Store Connect is connected, but no app is linked yet. Add an App ID in Project Settings.",
    });
  });

  it("returns configured false when credentials are missing", async () => {
    const ctx = stubCtx(null, []);

    await expect(appStoreConnectDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });
});
