import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { describe, expect, it, vi } from "vitest";
import { sentryDataSource } from "./data-sources";

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

describe("sentry data source", () => {
  it("returns project setup state when credentials exist but no project is linked", async () => {
    const ctx = stubCtx({ authToken: "sntrys_test", orgSlug: "radarboard" }, [
      {
        slug: "radarboard",
        name: "Radarboard",
        color: "#111",
        platforms: [{ id: "web", name: "Web", integrations: {} }],
      },
    ]);

    await expect(sentryDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      ctaLabel: "Open Project Settings",
      ctaTarget: "intent:sentry-project",
      projectMappingRequired: true,
      setupMessage:
        "Sentry is connected, but no project is linked yet. Add a Sentry project slug in Project Settings.",
    });
  });

  it("returns configured false when credentials are missing", async () => {
    const ctx = stubCtx(null, []);

    await expect(sentryDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });
});
