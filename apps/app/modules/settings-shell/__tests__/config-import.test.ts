import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getSettingsRepo: vi.fn(),
  getPluginRepo: vi.fn(),
}));

import { getPluginRepo, getSettingsRepo } from "@/db/repository";
import { handleConfigImport as POST } from "@/modules/settings-shell/config-import";

const mockSettingsRepo = {
  setProjectOrder: vi.fn().mockResolvedValue(undefined),
  setWidgetLayout: vi.fn().mockResolvedValue(undefined),
  setProjectIntegrations: vi.fn().mockResolvedValue(undefined),
  setIntegrationConnections: vi.fn().mockResolvedValue(undefined),
  setProjectContextMap: vi.fn().mockResolvedValue(undefined),
  setFeaturePreferences: vi.fn().mockResolvedValue(undefined),
  setLlmConfig: vi.fn().mockResolvedValue(undefined),
  setDebugConfig: vi.fn().mockResolvedValue(undefined),
  setRoutingConfig: vi.fn().mockResolvedValue(undefined),
  setWorkflows: vi.fn().mockResolvedValue(undefined),
  setUserPlan: vi.fn().mockResolvedValue(undefined),
  setLicenseKey: vi.fn().mockResolvedValue(undefined),
};

const mockPluginRepo = {
  set: vi.fn().mockResolvedValue(undefined),
};

function makeRequest(data: unknown): Request {
  return new Request("http://localhost/api/system/config/import", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettingsRepo).mockReturnValue(mockSettingsRepo as never);
  vi.mocked(getPluginRepo).mockReturnValue(mockPluginRepo as never);
});

describe("POST /api/system/config/import", () => {
  // ---- Schema validation ----

  it("rejects missing version", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid version", async () => {
    const res = await POST(makeRequest({ version: "99" }));
    expect(res.status).toBe(400);
  });

  it("accepts version 1 (backwards compat)", async () => {
    const res = await POST(makeRequest({ version: "1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("accepts version 2", async () => {
    const res = await POST(makeRequest({ version: "2" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ---- v1 backup restores correctly ----

  it("restores all v1 domains", async () => {
    const v1Backup = {
      version: "1",
      projectOrder: ["proj-a"],
      widgetLayout: { layouts: [], configs: {} },
      projectIntegrations: { "proj-a": { github: { repo: "foo/bar" } } },
      integrationConnections: [{ id: "conn-1" }],
      projectContextMap: { "proj-a": { goal: "Ship v2" } },
      featurePreferences: { darkMode: true },
    };

    const res = await POST(makeRequest(v1Backup));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.applied.projectOrder).toBe(true);
    expect(body.applied.widgetLayout).toBe(true);
    expect(body.applied.projectIntegrations).toBe(true);
    expect(body.applied.integrationConnections).toBe(true);
    expect(body.applied.projectContextMap).toBe(true);
    expect(body.applied.featurePreferences).toBe(true);

    expect(mockSettingsRepo.setProjectOrder).toHaveBeenCalledWith(["proj-a"]);
    expect(mockSettingsRepo.setWidgetLayout).toHaveBeenCalledWith({ layouts: [], configs: {} });
  });

  it("does not call new domain setters for v1 backup", async () => {
    await POST(makeRequest({ version: "1", projectOrder: ["a"] }));

    expect(mockSettingsRepo.setLlmConfig).not.toHaveBeenCalled();
    expect(mockSettingsRepo.setDebugConfig).not.toHaveBeenCalled();
    expect(mockSettingsRepo.setRoutingConfig).not.toHaveBeenCalled();
    expect(mockSettingsRepo.setWorkflows).not.toHaveBeenCalled();
    expect(mockSettingsRepo.setUserPlan).not.toHaveBeenCalled();
    expect(mockSettingsRepo.setLicenseKey).not.toHaveBeenCalled();
    expect(mockPluginRepo.set).not.toHaveBeenCalled();
  });

  // ---- v2 backup restores all new domains ----

  it("restores all v2 domains including new ones", async () => {
    const v2Backup = {
      version: "2",
      projectOrder: ["proj-b"],
      featurePreferences: { darkMode: false },
      llmConfig: { identityPrompt: "Custom prompt" },
      debugConfig: { promotionEnabled: true },
      routingConfig: {
        rules: [
          {
            id: "r1",
            name: "Route 1",
            enabled: true,
            source: null,
            eventType: null,
            severity: null,
            surfaces: {},
          },
        ],
      },
      workflows: { "wf-1": { name: "Deploy" } },
      userPlan: "pro",
      licenseKey: "LIC-123",
      pluginData: {
        notes: [
          { key: "note-1", value: '{"title":"Hello"}' },
          { key: "note-2", value: '{"title":"World"}' },
        ],
      },
    };

    const res = await POST(makeRequest(v2Backup));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.errors).toEqual([]);

    // Original domains
    expect(mockSettingsRepo.setProjectOrder).toHaveBeenCalledWith(["proj-b"]);
    expect(mockSettingsRepo.setFeaturePreferences).toHaveBeenCalledWith({ darkMode: false });

    // New domains
    expect(mockSettingsRepo.setLlmConfig).toHaveBeenCalledWith({ identityPrompt: "Custom prompt" });
    expect(mockSettingsRepo.setDebugConfig).toHaveBeenCalledWith({ promotionEnabled: true });
    expect(mockSettingsRepo.setRoutingConfig).toHaveBeenCalled();
    expect(mockSettingsRepo.setWorkflows).toHaveBeenCalledWith({ "wf-1": { name: "Deploy" } });
    expect(mockSettingsRepo.setUserPlan).toHaveBeenCalledWith("pro");
    expect(mockSettingsRepo.setLicenseKey).toHaveBeenCalledWith("LIC-123");

    // Plugin data
    expect(mockPluginRepo.set).toHaveBeenCalledTimes(2);
    expect(mockPluginRepo.set).toHaveBeenCalledWith("notes", "note-1", '{"title":"Hello"}');
    expect(mockPluginRepo.set).toHaveBeenCalledWith("notes", "note-2", '{"title":"World"}');

    expect(body.applied.llmConfig).toBe(true);
    expect(body.applied.debugConfig).toBe(true);
    expect(body.applied.routingConfig).toBe(true);
    expect(body.applied.workflows).toBe(true);
    expect(body.applied.userPlan).toBe(true);
    expect(body.applied.licenseKey).toBe(true);
    expect(body.applied.pluginData).toBe(true);
  });

  // ---- Partial failure handling ----

  it("reports per-domain errors without failing the whole import", async () => {
    mockSettingsRepo.setLlmConfig.mockRejectedValue(new Error("LLM table missing"));
    mockSettingsRepo.setProjectOrder.mockRejectedValue(new Error("DB locked"));

    const res = await POST(
      makeRequest({
        version: "2",
        projectOrder: ["a"],
        llmConfig: { identityPrompt: "test" },
        featurePreferences: { darkMode: true },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.applied.projectOrder).toBe(false);
    expect(body.applied.llmConfig).toBe(false);
    expect(body.applied.featurePreferences).toBe(true);
    expect(body.errors).toHaveLength(2);
    expect(body.errors[0]).toContain("projectOrder");
    expect(body.errors[1]).toContain("LLM table missing");
  });

  it("handles plugin repo failure gracefully", async () => {
    vi.mocked(getPluginRepo).mockImplementation(() => {
      throw new Error("Plugin repo not available");
    });

    const res = await POST(
      makeRequest({
        version: "2",
        pluginData: { notes: [{ key: "k", value: "v" }] },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applied.pluginData).toBe(false);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("pluginData");
  });

  // ---- Edge cases ----

  it("skips empty workflows object", async () => {
    const res = await POST(makeRequest({ version: "2", workflows: {} }));
    await res.json();

    expect(mockSettingsRepo.setWorkflows).not.toHaveBeenCalled();
  });

  it("skips null llmConfig", async () => {
    const res = await POST(makeRequest({ version: "2", llmConfig: null }));
    await res.json();

    expect(mockSettingsRepo.setLlmConfig).not.toHaveBeenCalled();
  });

  it("ignores credentialKeys field (informational only)", async () => {
    const res = await POST(
      makeRequest({
        version: "2",
        credentialKeys: ["github", "sentry"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // credentialKeys is accepted by schema but not applied
    expect(body.applied.credentialKeys).toBeUndefined();
  });
});
