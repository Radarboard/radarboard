import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getSettingsRepo: vi.fn(),
  getCredentialRepo: vi.fn(),
  getPluginRepo: vi.fn(),
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  PLUGIN_REGISTRY: new Map([
    ["notes", { id: "notes" }],
    ["tasks", { id: "tasks" }],
  ]),
}));

vi.mock("@/lib/plugins-init", () => ({}));

import { getCredentialRepo, getPluginRepo, getSettingsRepo } from "@/db/repository";
import { handleConfigExport as GET } from "@/modules/settings-shell/config-export";

const mockSettingsRepo = {
  getProjectOrder: vi.fn().mockResolvedValue(["project-a"]),
  getWidgetLayout: vi.fn().mockResolvedValue({ layouts: [] }),
  getProjectIntegrations: vi.fn().mockResolvedValue({}),
  getIntegrationConnections: vi.fn().mockResolvedValue([]),
  getProjectContextMap: vi.fn().mockResolvedValue({}),
  getFeaturePreferences: vi.fn().mockResolvedValue({ darkMode: true }),
  getLlmConfig: vi.fn().mockResolvedValue({ identityPrompt: "You are helpful" }),
  getDebugConfig: vi.fn().mockResolvedValue({ promotionEnabled: false }),
  getRoutingConfig: vi.fn().mockResolvedValue({ rules: [] }),
  getWorkflows: vi.fn().mockResolvedValue({ "wf-1": { name: "Deploy" } }),
  getUserIntegrations: vi.fn().mockResolvedValue([{ id: "acme" }]),
  getUserPlan: vi.fn().mockResolvedValue("pro"),
  getLicenseKey: vi.fn().mockResolvedValue("LICENSE-KEY-123"),
};

const mockCredentialRepo = {
  listCredentialKeys: vi.fn().mockResolvedValue(["github", "sentry", "revenuecat"]),
};

const mockPluginRepo = {
  list: vi.fn().mockImplementation((pluginId: string) => {
    if (pluginId === "notes") {
      return Promise.resolve([{ key: "note-1", value: JSON.stringify({ title: "My note" }) }]);
    }
    return Promise.resolve([]);
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettingsRepo).mockReturnValue(mockSettingsRepo as never);
  vi.mocked(getCredentialRepo).mockReturnValue(mockCredentialRepo as never);
  vi.mocked(getPluginRepo).mockReturnValue(mockPluginRepo as never);
});

describe("GET /api/system/config/export", () => {
  it("returns a v2 snapshot with all settings domains", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.version).toBe("2");
    expect(body.exportedAt).toBeDefined();

    // Original v1 domains
    expect(body.projectOrder).toEqual(["project-a"]);
    expect(body.widgetLayout).toEqual({ layouts: [] });
    expect(body.projectIntegrations).toEqual({});
    expect(body.integrationConnections).toEqual([]);
    expect(body.projectContextMap).toEqual({});
    expect(body.featurePreferences).toEqual({ darkMode: true });

    // New v2 domains
    expect(body.llmConfig).toEqual({ identityPrompt: "You are helpful" });
    expect(body.debugConfig).toEqual({ promotionEnabled: false });
    expect(body.routingConfig).toEqual({ rules: [] });
    expect(body.workflows).toEqual({ "wf-1": { name: "Deploy" } });
    // User-created REST integrations must ride along in the snapshot, or they are
    // silently lost on backup/restore and device migration.
    expect(body.userIntegrations).toEqual([{ id: "acme" }]);
    expect(body.userPlan).toBe("pro");
    expect(body.licenseKey).toBe("LICENSE-KEY-123");
  });

  it("includes credential key inventory without values", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.credentialKeys).toEqual(["github", "sentry", "revenuecat"]);
    // Ensure no actual credential values leak
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("includes plugin data for plugins that have stored data", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.pluginData).toEqual({
      notes: [{ key: "note-1", value: JSON.stringify({ title: "My note" }) }],
    });
    // tasks plugin had no data, should be excluded
    expect(body.pluginData.tasks).toBeUndefined();
  });

  it("sets Content-Disposition header for download", async () => {
    const res = await GET();
    const disposition = res.headers.get("Content-Disposition");

    expect(disposition).toMatch(
      /^attachment; filename="radarboard-config-\d{4}-\d{2}-\d{2}\.json"$/
    );
  });

  it("gracefully handles settings repo failures for individual domains", async () => {
    mockSettingsRepo.getLlmConfig.mockRejectedValue(new Error("DB error"));
    mockSettingsRepo.getWorkflows.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    // Failed domains fall back to null/empty
    expect(body.llmConfig).toBeNull();
    expect(body.workflows).toEqual({});
    // Other domains still work
    expect(body.projectOrder).toEqual(["project-a"]);
  });

  it("handles credential repo unavailability gracefully", async () => {
    vi.mocked(getCredentialRepo).mockImplementation(() => {
      throw new Error("Credential repo not available");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.credentialKeys).toEqual([]);
  });

  it("handles plugin repo unavailability gracefully", async () => {
    vi.mocked(getPluginRepo).mockImplementation(() => {
      throw new Error("Plugin repo not available");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pluginData).toEqual({});
  });
});
