import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations-init", () => ({}));
vi.mock("@/lib/plugins-init", () => ({}));
vi.mock("@/lib/widgets-init", () => ({}));

const getAllIntegrationsMock = vi.fn();
const getAllPluginsMock = vi.fn();
const getAllInstalledExtensionsMock = vi.fn();

const { WIDGET_REGISTRY_MOCK } = vi.hoisted(() => ({
  WIDGET_REGISTRY_MOCK: new Map(),
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

vi.mock("@/data/extensions/sqlite-installed-extensions", () => ({
  getAllInstalledExtensions: (...args: unknown[]) => getAllInstalledExtensionsMock(...args),
}));

vi.mock("@/lib/system/runtime/env", () => ({
  getWebEnv: () => undefined,
  WEB_ENV_KEYS: {
    extensions: { communityCatalogUrl: "RADARBOARD_COMMUNITY_EXTENSIONS_CATALOG_URL" },
  },
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleGetExtensionCatalog as GET } from "@/modules/extensions-shell/routes/catalog";

beforeEach(() => {
  vi.clearAllMocks();
  WIDGET_REGISTRY_MOCK.clear();
  getAllInstalledExtensionsMock.mockResolvedValue([]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ generatedAt: "2026-05-31T00:00:00.000Z", extensions: [] }),
    })
  );
});

describe("GET /api/extensions/catalog", () => {
  it("returns official registry entries", async () => {
    getAllIntegrationsMock.mockReturnValue([
      {
        id: "github",
        name: "GitHub",
        description: "Repository activity",
        category: "development",
        capabilities: [{ id: "stars", action: "stars" }],
      },
    ]);
    getAllPluginsMock.mockReturnValue([
      {
        id: "notes",
        name: "Notes",
        description: "Markdown notes",
        category: "productivity",
        version: "0.2.0",
        requiredIntegrations: [],
      },
    ]);
    WIDGET_REGISTRY_MOCK.set("stars", {
      id: "stars",
      name: "Stars",
      description: "GitHub stars",
      catalogCategory: "community",
      capabilities: [
        { id: "stars", role: "canonical", providers: [{ integration: "github", action: "stars" }] },
      ],
      requiredIntegrations: ["github"],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "github", source: "official", type: "integration" }),
        expect.objectContaining({ id: "notes", source: "official", type: "plugin" }),
        expect.objectContaining({ id: "stars", source: "official", type: "widget" }),
      ])
    );
  });

  it("merges community catalog entries and marks installed GitHub repos", async () => {
    getAllIntegrationsMock.mockReturnValue([]);
    getAllPluginsMock.mockReturnValue([]);
    getAllInstalledExtensionsMock.mockResolvedValue([
      {
        id: "acme/radarboard-weather",
        githubUrl: "https://github.com/acme/radarboard-weather",
        commitSha: "abc123",
        extensionTypes: ["widget"],
        installedAt: 1,
        updatedAt: 1,
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: "2026-05-31T00:00:00.000Z",
          extensions: [
            {
              id: "weather",
              type: "widget",
              name: "Weather",
              description: "Forecast card",
              tier: "community",
              installUrl: "https://github.com/acme/radarboard-weather",
              tags: ["forecast"],
            },
          ],
        }),
      })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.extensions).toEqual([
      expect.objectContaining({
        id: "weather",
        source: "community",
        installed: true,
        installable: true,
      }),
    ]);
  });

  it("returns official entries when the community catalog is unavailable", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub", description: "Repository activity", capabilities: [] },
    ]);
    getAllPluginsMock.mockReturnValue([]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.communityCatalogError).toBe("offline");
    expect(body.extensions).toEqual([
      expect.objectContaining({ id: "github", source: "official" }),
    ]);
  });
});
