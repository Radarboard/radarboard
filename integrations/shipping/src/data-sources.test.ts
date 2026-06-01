import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shippingDataSource, shippingDataSources } from "./api/data-sources";

const stubParams: { limit: number } & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
  limit: 20,
};

function stubCtx({
  credentials = {},
  projects = [],
  projectIntegrations = {},
}: {
  credentials?: Record<string, Record<string, string> | null>;
  projects?: Awaited<ReturnType<DataSourceContext["getAllProjects"]>>;
  projectIntegrations?: Awaited<ReturnType<DataSourceContext["getProjectIntegrations"]>>;
} = {}): DataSourceContext {
  return {
    resolveCredential: vi.fn(async (key: string) => credentials[key] ?? null),
    getProjectIntegrations: vi.fn(async () => projectIntegrations),
    getAllProjects: vi.fn(async () => projects),
  };
}

describe("shippingDataSources", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T18:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exports the shipping aggregate data source", () => {
    expect(shippingDataSources).toHaveLength(1);
    expect(shippingDataSources[0]?.action).toBe("data");
  });

  it("returns a provider chooser only when no release activity provider is configured", async () => {
    const ctx = stubCtx();

    await expect(shippingDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      items: [],
      setupMessage: "Connect GitHub, Linear, or Vercel to show release activity.",
      ctaLabel: "Choose integration",
      ctaTarget: "intent:release-activity",
    });
  });

  it("treats configured providers as configured even when recent activity is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ deployments: [] }),
      }))
    );
    const ctx = stubCtx({
      credentials: {
        vercel: { token: "vc-token" },
      },
    });

    await expect(shippingDataSource.fetch(stubParams, ctx)).resolves.toMatchObject({
      configured: true,
      items: [],
    });
  });

  it("maps Linear completed issues into release activity items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: "issue-id",
                  identifier: "RAD-12",
                  title: "Ship release activity",
                  url: "https://linear.app/radarboard/issue/RAD-12",
                  completedAt: "2026-06-01T17:30:00.000Z",
                  team: { id: "team-1", name: "Product" },
                  project: { name: "Radarboard", color: "#111111" },
                },
              ],
            },
          },
        }),
      }))
    );
    const ctx = stubCtx({
      credentials: {
        linear: { apiKey: "lin_api_test" },
      },
    });

    await expect(shippingDataSource.fetch(stubParams, ctx)).resolves.toMatchObject({
      configured: true,
      items: [
        {
          id: "linear:issue-id",
          title: "RAD-12 Ship release activity",
          projectName: "Radarboard",
          source: "linear",
          timeAgo: "30m ago",
        },
      ],
    });
  });
});
