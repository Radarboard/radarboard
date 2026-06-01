import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllIntegrationsMock = vi.fn();
const getAllPluginsMock = vi.fn();

const { WIDGET_REGISTRY_MOCK } = vi.hoisted(() => ({
  WIDGET_REGISTRY_MOCK: new Map(),
}));

vi.mock("@/lib/integrations-init", () => ({}));
vi.mock("@/lib/widgets-init", () => ({
  initializeWidgetDescriptors: vi.fn(),
}));

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getAllIntegrations: (...args: unknown[]) => getAllIntegrationsMock(...args),
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: (...args: unknown[]) => getAllPluginsMock(...args),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  WIDGET_REGISTRY: WIDGET_REGISTRY_MOCK,
}));

vi.mock("@/lib/extensions/capability-governance", () => ({
  auditCapabilityGovernance: vi.fn().mockReturnValue([]),
  formatCapabilityLabel: (id: string) => id.replace(/\./g, " "),
  getCanonicalWidgetMap: () => new Map(),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleGetDependencyGraph as GET } from "@/modules/extensions-shell/routes/dependency-graph";

beforeEach(() => {
  getAllIntegrationsMock.mockReset();
  getAllPluginsMock.mockReset();
  WIDGET_REGISTRY_MOCK.clear();
});

describe("GET /api/extensions/dependency-graph", () => {
  it("returns nodes and edges for integrations, plugins, and widgets", async () => {
    getAllIntegrationsMock.mockReturnValue([{ id: "github", name: "GitHub", capabilities: [] }]);
    getAllPluginsMock.mockReturnValue([
      {
        id: "notes",
        name: "Notes",
        category: "productivity",
        requiredIntegrations: [],
        dependencies: [],
        intents: [],
      },
    ]);
    WIDGET_REGISTRY_MOCK.set("stars", {
      id: "stars",
      name: "Stars",
      requiredIntegrations: ["github"],
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nodes).toContainEqual(
      expect.objectContaining({ id: "integration:github", type: "integration" })
    );
    expect(body.nodes).toContainEqual(
      expect.objectContaining({ id: "plugin:notes", type: "plugin" })
    );
    expect(body.nodes).toContainEqual(
      expect.objectContaining({ id: "widget:stars", type: "widget" })
    );

    expect(body.edges).toContainEqual(
      expect.objectContaining({
        source: "widget:stars",
        target: "integration:github",
        label: "requires",
      })
    );
  });

  it("includes stats summary", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub", capabilities: [] },
      { id: "sentry", name: "Sentry", capabilities: [] },
    ]);
    getAllPluginsMock.mockReturnValue([]);
    WIDGET_REGISTRY_MOCK.set("commits", {
      id: "commits",
      name: "Commits",
      requiredIntegrations: [],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.stats).toEqual({
      totalNodes: 3,
      totalEdges: 0,
      integrations: 2,
      plugins: 0,
      widgets: 1,
    });
  });

  it("creates plugin dependency edges", async () => {
    getAllIntegrationsMock.mockReturnValue([]);
    getAllPluginsMock.mockReturnValue([
      {
        id: "changelog",
        name: "Changelog",
        requiredIntegrations: ["github"],
        dependencies: ["notes"],
        intents: [],
      },
      {
        id: "notes",
        name: "Notes",
        requiredIntegrations: [],
        dependencies: [],
        intents: [],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.edges).toContainEqual(
      expect.objectContaining({
        source: "plugin:changelog",
        target: "integration:github",
        label: "requires",
      })
    );
    expect(body.edges).toContainEqual(
      expect.objectContaining({
        source: "plugin:changelog",
        target: "plugin:notes",
        label: "depends on",
      })
    );
  });

  it("creates intent edges between plugins", async () => {
    getAllIntegrationsMock.mockReturnValue([]);
    getAllPluginsMock.mockReturnValue([
      {
        id: "changelog",
        name: "Changelog",
        requiredIntegrations: [],
        dependencies: [],
        intents: [{ action: "create_task" }],
      },
      {
        id: "tasks",
        name: "Tasks",
        requiredIntegrations: [],
        dependencies: [],
        intents: [{ action: "create_task" }],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.edges).toContainEqual(
      expect.objectContaining({
        source: "plugin:changelog",
        target: "plugin:tasks",
        label: "intent: create_task",
      })
    );
  });

  it("returns empty graph when no extensions", async () => {
    getAllIntegrationsMock.mockReturnValue([]);
    getAllPluginsMock.mockReturnValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.nodes).toEqual([]);
    expect(body.edges).toEqual([]);
    expect(body.stats.totalNodes).toBe(0);
  });

  it("returns 500 on error", async () => {
    getAllIntegrationsMock.mockImplementation(() => {
      throw new Error("Registry corrupt");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Registry corrupt");
  });
});
