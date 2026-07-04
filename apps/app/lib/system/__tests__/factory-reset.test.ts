import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheRepo = { clear: vi.fn() };
const mockCredentialRepo = {
  listCredentialKeys: vi.fn(),
  deleteCredential: vi.fn(),
};
const mockPluginRepo = { list: vi.fn(), delete: vi.fn() };
const mockStarHistoryRepo = { clearAll: vi.fn() };
const mockLlmRepo = { clearAll: vi.fn() };
const mockNotificationRepo = { clearAll: vi.fn() };
const mockDebugRepo = { clearAll: vi.fn() };
const mockSettingsRepo = {
  setWidgetLayout: vi.fn(),
  setProjectOrder: vi.fn(),
  setProjectIntegrations: vi.fn(),
  setIntegrationConnections: vi.fn(),
  setProjectContextMap: vi.fn(),
  setLlmConfig: vi.fn(),
  setDebugConfig: vi.fn(),
  setRoutingConfig: vi.fn(),
  setWorkflows: vi.fn(),
  setUserIntegrations: vi.fn(),
  setFeaturePreferences: vi.fn(),
};

vi.mock("@/data/core/repository", () => ({
  getCacheRepo: () => mockCacheRepo,
  getCredentialRepo: () => mockCredentialRepo,
  getPluginRepo: () => mockPluginRepo,
  getGitHubStarHistoryRepo: () => mockStarHistoryRepo,
  getLlmRepo: () => mockLlmRepo,
  getNotificationRepo: () => mockNotificationRepo,
  getDebugRepo: () => mockDebugRepo,
  getSettingsRepo: () => mockSettingsRepo,
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  PLUGIN_REGISTRY: new Map([["notes", {}]]),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

vi.mock("@radarboard/hooks/dashboard-layout", () => ({
  createDefaultDashboardPage: vi.fn(() => ({ slug: "overview", name: "Overview" })),
  createEmptyDashboardWidgetLayout: vi.fn(() => ({})),
}));

vi.mock("@radarboard/widget-engine/layouts", () => ({
  BASIC_3X3: { id: "basic-3x3", name: "Basic 3x3", cells: [], colSizes: [], rowSizes: [] },
}));

import { performFactoryReset } from "@/lib/system/factory-reset";

beforeEach(() => {
  vi.clearAllMocks();
  mockCredentialRepo.listCredentialKeys.mockResolvedValue(["github", "vercel"]);
  mockPluginRepo.list.mockResolvedValue([{ key: "a", value: "1" }]);
});

describe("performFactoryReset", () => {
  it("clears every store and resets settings to defaults", async () => {
    const result = await performFactoryReset();

    expect(mockCacheRepo.clear).toHaveBeenCalledTimes(1);
    expect(mockCredentialRepo.deleteCredential).toHaveBeenCalledWith("github");
    expect(mockCredentialRepo.deleteCredential).toHaveBeenCalledWith("vercel");
    expect(mockPluginRepo.delete).toHaveBeenCalledWith("notes", "a");
    expect(mockStarHistoryRepo.clearAll).toHaveBeenCalledTimes(1);
    expect(mockLlmRepo.clearAll).toHaveBeenCalledTimes(1);
    expect(mockNotificationRepo.clearAll).toHaveBeenCalledTimes(1);
    expect(mockDebugRepo.clearAll).toHaveBeenCalledTimes(1);
    expect(mockSettingsRepo.setWidgetLayout).toHaveBeenCalledTimes(1);
    expect(mockSettingsRepo.setIntegrationConnections).toHaveBeenCalledWith([]);

    expect(result.errors).toEqual([]);
    expect(result.cleared).toEqual(
      expect.arrayContaining([
        "cache",
        "credentials",
        "pluginData",
        "githubStarHistory",
        "llm",
        "notifications",
        "debug",
        "settings",
      ])
    );
  });

  it("aggregates errors without aborting other steps", async () => {
    mockLlmRepo.clearAll.mockRejectedValueOnce(new Error("llm boom"));

    const result = await performFactoryReset();

    expect(result.errors).toEqual(["llm: llm boom"]);
    // Steps after the failure still ran.
    expect(mockDebugRepo.clearAll).toHaveBeenCalledTimes(1);
    expect(mockSettingsRepo.setWidgetLayout).toHaveBeenCalledTimes(1);
    expect(result.cleared).not.toContain("llm");
    expect(result.cleared).toContain("settings");
  });
});
