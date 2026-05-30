import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const getMetrics = vi.fn();
const getLiveVisitors = vi.fn();
const getManagedProject = vi.fn();
const listManagedProjects = vi.fn();
const getReferrers = vi.fn();
const getTopPages = vi.fn();

vi.mock("./client", () => ({
  getMetrics: (...args: unknown[]) => getMetrics(...args),
  getLiveVisitors: (...args: unknown[]) => getLiveVisitors(...args),
  getManagedProject: (...args: unknown[]) => getManagedProject(...args),
  listManagedProjects: (...args: unknown[]) => listManagedProjects(...args),
  getReferrers: (...args: unknown[]) => getReferrers(...args),
  getTopPages: (...args: unknown[]) => getTopPages(...args),
}));

import { openpanelDataSource, openpanelProjectsDataSource } from "./data-sources";

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

describe("openpanel data source", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getMetrics.mockReset();
    getLiveVisitors.mockReset();
    getManagedProject.mockReset();
    listManagedProjects.mockReset();
    getReferrers.mockReset();
    getTopPages.mockReset();
  });

  it("returns project-mapping-required state when credentials exist but no project is linked", async () => {
    const ctx = stubCtx({ clientId: "client-id", clientSecret: "client-secret" }, [
      {
        slug: "radarboard",
        name: "Radarboard",
        color: "#111",
        platforms: [{ id: "web", name: "Web", integrations: {} }],
      },
    ]);

    await expect(openpanelDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      ctaLabel: "Open Project Settings",
      ctaTarget: "intent:openpanel-project",
      projectMappingRequired: true,
      setupMessage:
        "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings.",
    });
  });

  it("returns configured false when credentials are missing", async () => {
    const ctx = stubCtx(null, []);

    await expect(openpanelDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });

  it("uses saved openPanel.projectId overrides when platform integrations do not include a static project id", async () => {
    getMetrics.mockResolvedValue({
      metrics: {
        bounce_rate: 12.5,
        unique_visitors: 100,
        total_sessions: 140,
        avg_session_duration: 45,
        total_screen_views: 300,
        views_per_session: 2.14,
      },
      series: [{ date: "2026-04-08", unique_visitors: 100 }],
    });
    getLiveVisitors.mockResolvedValue({ visitors: 5 });
    getTopPages.mockResolvedValue([]);
    getReferrers.mockResolvedValue([]);
    getManagedProject.mockResolvedValue({ id: "goshuin-atlas-web", organizationId: "org_1" });

    const ctx: DataSourceContext = {
      resolveCredential: vi
        .fn()
        .mockResolvedValue({ clientId: "client-id", clientSecret: "client-secret" }),
      getProjectIntegrations: vi.fn().mockResolvedValue({
        "goshuin-atlas": {
          website: {
            "openPanel.projectId": "goshuin-atlas-web",
          },
        },
      }),
      getAllProjects: vi.fn().mockResolvedValue([
        {
          slug: "goshuin-atlas",
          name: "Goshuin Atlas",
          color: "#111",
          platforms: [{ id: "website", name: "Website", integrations: {} }],
        },
      ]),
    };

    await expect(
      openpanelDataSource.fetch(
        {
          ...stubParams,
          projectSlug: "goshuin-atlas",
        },
        ctx
      )
    ).resolves.toMatchObject({
      configured: true,
      analytics: {
        liveVisitors: 5,
        metrics: {
          uniqueVisitors: 100,
          totalSessions: 140,
          totalPageViews: 300,
        },
      },
    });
  });

  it("returns configured false with empty project list when OpenPanel credentials are missing", async () => {
    const ctx = stubCtx(null, []);

    await expect(openpanelProjectsDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      projects: [],
    });
  });

  it("returns normalized OpenPanel projects when account projects are available", async () => {
    listManagedProjects.mockResolvedValue([
      { id: "op_2", name: "Zeta", organizationId: "org_1" },
      { id: "op_1", name: "Atlas", organizationId: "org_1" },
    ]);

    const ctx = stubCtx({ clientId: "client-id", clientSecret: "client-secret" }, []);

    await expect(openpanelProjectsDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: true,
      projects: [
        { id: "op_2", name: "Zeta", organizationId: "org_1" },
        { id: "op_1", name: "Atlas", organizationId: "org_1" },
      ],
    });
  });

  it("returns configured false with empty projects when the OpenPanel project listing fails", async () => {
    listManagedProjects.mockRejectedValue(new Error("boom"));

    const ctx = stubCtx({ clientId: "client-id", clientSecret: "client-secret" }, []);

    await expect(openpanelProjectsDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
      projects: [],
    });
  });
});
