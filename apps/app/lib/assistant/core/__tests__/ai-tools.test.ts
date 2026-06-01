import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedDataSourceFetches = vi.hoisted(() => ({
  analytics: vi.fn(),
  appStore: vi.fn(),
  health: vi.fn(),
  roadmap: vi.fn(),
  revenue: vi.fn(),
  settingsRepo: {
    getLlmConfig: vi.fn(),
    getProjectContextMap: vi.fn(),
    getProjectOrder: vi.fn(),
    setLlmConfig: vi.fn(),
    setProjectContextMap: vi.fn(),
  },
  sentry: vi.fn(),
  seo: vi.fn(),
  shipping: vi.fn(),
}));

vi.mock("../data-source-context", () => ({
  buildDataSourceContext: () => ({
    resolveCredential: vi.fn(),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue([]),
    getMcpClient: vi.fn(),
  }),
}));

vi.mock("@/data/core/repository", () => ({
  getSettingsRepo: () => mockedDataSourceFetches.settingsRepo,
}));

vi.mock("@radarboard/integration-sdk/registry", () => ({
  findDataSource: (integration: string, action: string) => {
    const key = `${integration}/${action}`;
    const fetchers: Record<string, (...args: unknown[]) => Promise<unknown>> = {
      "revenuecat/data": mockedDataSourceFetches.revenue,
      "openpanel/data": mockedDataSourceFetches.analytics,
      "betterstack/data": mockedDataSourceFetches.health,
      "sentry/data": mockedDataSourceFetches.sentry,
      "google-search-console/data": mockedDataSourceFetches.seo,
      "linear/roadmap": mockedDataSourceFetches.roadmap,
      "shipping/data": mockedDataSourceFetches.shipping,
      "app-store-connect/data": mockedDataSourceFetches.appStore,
    };

    const fetch = fetchers[key];
    if (!fetch) return undefined;
    return { action, fetch };
  },
}));

vi.mock("@radarboard/integration-shipping/data-sources", () => ({
  shippingDataSources: [{ action: "data", fetch: mockedDataSourceFetches.shipping }],
}));

import { AI_TOOL_REGISTRY, buildAiTools, buildSelfTools, getAvailableToolNames } from "../ai-tools";

describe("ai-tools", () => {
  beforeEach(() => {
    for (const fetch of Object.values(mockedDataSourceFetches)) {
      if ("mockReset" in fetch && typeof fetch.mockReset === "function") {
        fetch.mockReset();
      }
    }
    mockedDataSourceFetches.settingsRepo.getProjectContextMap.mockResolvedValue({});
    mockedDataSourceFetches.settingsRepo.getProjectOrder.mockResolvedValue([]);
    mockedDataSourceFetches.settingsRepo.getLlmConfig.mockResolvedValue({});
    mockedDataSourceFetches.settingsRepo.setProjectContextMap.mockResolvedValue(undefined);
    mockedDataSourceFetches.settingsRepo.setLlmConfig.mockResolvedValue(undefined);
  });

  describe("AI_TOOL_REGISTRY", () => {
    it("is a non-empty Map with matching ids", () => {
      expect(AI_TOOL_REGISTRY).toBeInstanceOf(Map);
      expect(AI_TOOL_REGISTRY.size).toBeGreaterThan(0);
      for (const [id, desc] of AI_TOOL_REGISTRY) {
        expect(desc.id).toBe(id);
        expect(desc.description.length).toBeGreaterThan(0);
        expect(desc.parameters).toBeDefined();
        expect(desc.execute).toBeTypeOf("function");
      }
    });
  });

  describe("getAvailableToolNames", () => {
    it("returns a non-empty array of tool names", () => {
      const names = getAvailableToolNames();
      expect(names.length).toBeGreaterThan(0);
    });

    it("includes core data tools", () => {
      const names = getAvailableToolNames();
      expect(names).toContain("get_revenue");
      expect(names).toContain("get_analytics");
      expect(names).toContain("get_sentry_issues");
      expect(names).toContain("get_health");
      expect(names).toContain("get_seo");
      expect(names).toContain("get_roadmap");
      expect(names).toContain("get_shipping");
    });

    it("includes project management tools", () => {
      const names = getAvailableToolNames();
      expect(names).toContain("list_projects");
    });
  });

  describe("buildAiTools", () => {
    it("returns an object with tool definitions", () => {
      const tools = buildAiTools();
      expect(typeof tools).toBe("object");
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it("every tool has a description and inputSchema", () => {
      const tools = buildAiTools();
      for (const [name, toolDef] of Object.entries(tools)) {
        expect(toolDef.description, `${name} missing description`).toBeDefined();
        expect(typeof toolDef.description).toBe("string");
        expect(toolDef.description.length, `${name} has empty description`).toBeGreaterThan(0);
        expect(toolDef.inputSchema, `${name} missing inputSchema`).toBeDefined();
      }
    });

    it("every tool has an execute function", () => {
      const tools = buildAiTools();
      for (const [name, toolDef] of Object.entries(tools)) {
        expect(toolDef.execute, `${name} missing execute`).toBeTypeOf("function");
      }
    });

    it("filters to only connected credential keys when provided", () => {
      const allTools = buildAiTools();
      const filtered = buildAiTools(["revenuecat"]);

      // Filtered should have get_revenue (revenuecat) + always-on tools (credentialKey: null)
      expect(filtered.get_revenue).toBeDefined();
      expect(filtered.list_projects).toBeDefined();
      expect(filtered.get_shipping).toBeDefined();
      // Should NOT have tools for unconnected services
      expect(filtered.get_sentry_issues).toBeUndefined();
      expect(filtered.get_analytics).toBeUndefined();
      // Filtered should be smaller than all
      expect(Object.keys(filtered).length).toBeLessThan(Object.keys(allTools).length);
    });

    it.each([
      {
        toolName: "get_revenue",
        fetch: mockedDataSourceFetches.revenue,
        params: { projectSlug: "goshuin-atlas", range: "30d", currency: "USD" },
      },
      {
        toolName: "get_analytics",
        fetch: mockedDataSourceFetches.analytics,
        params: { projectSlug: "goshuin-atlas", range: "30d" },
      },
      {
        toolName: "get_health",
        fetch: mockedDataSourceFetches.health,
        params: {},
      },
      {
        toolName: "get_sentry_issues",
        fetch: mockedDataSourceFetches.sentry,
        params: { projectSlug: "goshuin-atlas" },
      },
      {
        toolName: "get_seo",
        fetch: mockedDataSourceFetches.seo,
        params: { projectSlug: "goshuin-atlas", siteUrl: null },
      },
      {
        toolName: "get_roadmap",
        fetch: mockedDataSourceFetches.roadmap,
        params: { projectSlug: "goshuin-atlas", limit: 5 },
      },
      {
        toolName: "get_shipping",
        fetch: mockedDataSourceFetches.shipping,
        params: { projectSlug: "goshuin-atlas", limit: 5 },
      },
      {
        toolName: "get_app_store",
        fetch: mockedDataSourceFetches.appStore,
        params: { projectSlug: "goshuin-atlas" },
      },
    ])("executes $toolName via an exported integration module", async ({
      toolName,
      fetch,
      params,
    }) => {
      const expected = { ok: toolName };
      fetch.mockResolvedValue(expected);

      const tools = buildAiTools();
      const toolDef = tools[toolName] as {
        execute: (params: Record<string, unknown>) => Promise<unknown>;
      };

      await expect(toolDef.execute(params)).resolves.toEqual(expected);
      expect(fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          projectSlug: null,
          range: "30d",
          timeZone: "UTC",
          forceRefresh: false,
          ...params,
        }),
        expect.objectContaining({
          resolveCredential: expect.any(Function),
          getProjectIntegrations: expect.any(Function),
          getAllProjects: expect.any(Function),
          getMcpClient: expect.any(Function),
        })
      );
    });
  });

  describe("buildSelfTools", () => {
    it("adds priorities through update_project_context", async () => {
      mockedDataSourceFetches.settingsRepo.getProjectContextMap.mockResolvedValue({
        "goshuin-atlas": {
          goals: [],
          priorities: [],
          notes: "",
          stage: "growth",
        },
      });

      const tools = buildSelfTools();
      const toolDef = tools.update_project_context as {
        execute: (params: Record<string, unknown>) => Promise<unknown>;
      };

      await expect(
        toolDef.execute({
          projectSlug: "goshuin-atlas",
          addPriority: {
            title: "Fix onboarding",
            impact: "high",
            effort: "medium",
            status: "active",
          },
        })
      ).resolves.toEqual({ updated: true, projectSlug: "goshuin-atlas" });

      expect(mockedDataSourceFetches.settingsRepo.setProjectContextMap).toHaveBeenCalledWith({
        "goshuin-atlas": {
          goals: [],
          priorities: [
            expect.objectContaining({
              id: expect.any(String),
              title: "Fix onboarding",
              impact: "high",
              effort: "medium",
              status: "active",
            }),
          ],
          notes: "",
          stage: "growth",
        },
      });
    });

    it("updates priorities through update_project_context", async () => {
      mockedDataSourceFetches.settingsRepo.getProjectContextMap.mockResolvedValue({
        "goshuin-atlas": {
          goals: [],
          priorities: [
            {
              id: "priority-1",
              title: "Fix onboarding",
              impact: "medium",
              effort: "medium",
              status: "active",
            },
          ],
          notes: "",
          stage: "growth",
        },
      });

      const tools = buildSelfTools();
      const toolDef = tools.update_project_context as {
        execute: (params: Record<string, unknown>) => Promise<unknown>;
      };

      await expect(
        toolDef.execute({
          projectSlug: "goshuin-atlas",
          updatePriority: {
            title: "Fix onboarding",
            nextTitle: "Fix onboarding funnel",
            impact: "high",
            effort: "small",
            status: "done",
          },
        })
      ).resolves.toEqual({ updated: true, projectSlug: "goshuin-atlas" });

      expect(mockedDataSourceFetches.settingsRepo.setProjectContextMap).toHaveBeenCalledWith({
        "goshuin-atlas": {
          goals: [],
          priorities: [
            {
              id: "priority-1",
              title: "Fix onboarding funnel",
              impact: "high",
              effort: "small",
              status: "done",
            },
          ],
          notes: "",
          stage: "growth",
        },
      });
    });
  });
});
