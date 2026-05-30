import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { describe, expect, it, vi } from "vitest";
import { gscDataSource } from "./data-sources";

const stubParams: { siteUrl: string | null } & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  siteUrl: null,
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

describe("google search console data source", () => {
  it("returns project setup state when credentials exist but no site is linked", async () => {
    const ctx = stubCtx(
      { refreshToken: "refresh-token", clientId: "client-id", clientSecret: "client-secret" },
      [
        {
          slug: "radarboard",
          name: "Radarboard",
          color: "#111",
          platforms: [{ id: "web", name: "Web", integrations: {} }],
        },
      ]
    );

    await expect(gscDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      ctaLabel: "Open Project Settings",
      ctaTarget: "intent:google-search-console-project",
      projectMappingRequired: true,
      setupMessage:
        "Google Search Console is connected, but no site is linked yet. Add a site URL in Project Settings.",
    });
  });

  it("returns configured false when credentials are missing", async () => {
    const ctx = stubCtx(null, []);

    await expect(gscDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });
});
