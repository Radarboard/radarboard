import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getSettingsRepo: vi.fn(),
  getCredentialRepo: vi.fn(),
  getPluginRepo: vi.fn(),
  getCacheRepo: vi.fn(),
  getGitHubStarHistoryRepo: vi.fn(),
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  PLUGIN_REGISTRY: new Map([
    ["notes", { id: "notes" }],
    ["tasks", { id: "tasks" }],
  ]),
}));

vi.mock("@/lib/radarboard-config", () => ({
  getDatabaseConfig: vi.fn(() => ({ provider: "sqlite" })),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import {
  getCacheRepo,
  getCredentialRepo,
  getGitHubStarHistoryRepo,
  getPluginRepo,
  getSettingsRepo,
} from "@/db/repository";
import { handleExportDatabase as GET, handleImportDatabase as POST } from "../transfer";

const mockSettingsRepo = {
  getProjectOrder: vi.fn().mockResolvedValue(["project-a"]),
  setProjectOrder: vi.fn().mockResolvedValue(undefined),
  getWidgetLayout: vi.fn().mockResolvedValue({ configs: {}, layouts: [] }),
  setWidgetLayout: vi.fn().mockResolvedValue(undefined),
  getProjectIntegrations: vi
    .fn()
    .mockResolvedValue({ "project-a": { github: { repo: "foo/bar" } } }),
  setProjectIntegrations: vi.fn().mockResolvedValue(undefined),
  getIntegrationConnections: vi.fn().mockResolvedValue([{ id: "conn-1", provider: "github" }]),
  setIntegrationConnections: vi.fn().mockResolvedValue(undefined),
  getProjectContextMap: vi.fn().mockResolvedValue({ "project-a": { goal: "Ship" } }),
  setProjectContextMap: vi.fn().mockResolvedValue(undefined),
  getFeaturePreferences: vi.fn().mockResolvedValue({ darkMode: true }),
  setFeaturePreferences: vi.fn().mockResolvedValue(undefined),
  getLlmConfig: vi.fn().mockResolvedValue({ identityPrompt: "Hello" }),
  setLlmConfig: vi.fn().mockResolvedValue(undefined),
  getDebugConfig: vi.fn().mockResolvedValue({ promotionEnabled: true }),
  setDebugConfig: vi.fn().mockResolvedValue(undefined),
  getRoutingConfig: vi.fn().mockResolvedValue({ rules: [{ id: "rule-1", name: "Rule 1" }] }),
  setRoutingConfig: vi.fn().mockResolvedValue(undefined),
  getWorkflows: vi.fn().mockResolvedValue({ "wf-1": { name: "Deploy" } }),
  setWorkflows: vi.fn().mockResolvedValue(undefined),
  getUserPlan: vi.fn().mockResolvedValue("pro"),
  setUserPlan: vi.fn().mockResolvedValue(undefined),
  getLicenseKey: vi.fn().mockResolvedValue("LIC-123"),
  setLicenseKey: vi.fn().mockResolvedValue(undefined),
};

const mockCredentialRepo = {
  listCredentialKeys: vi.fn().mockResolvedValue(["github", "vercel"]),
  getCredential: vi
    .fn()
    .mockImplementation((key: string) =>
      Promise.resolve(key === "github" ? { token: "gh-secret" } : { accessToken: "vercel-secret" })
    ),
  setCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
};

const mockPluginRepo = {
  list: vi
    .fn()
    .mockImplementation((pluginId: string) =>
      Promise.resolve(pluginId === "notes" ? [{ key: "note-1", value: '{"title":"Hello"}' }] : [])
    ),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockCacheRepo = {
  listEntries: vi.fn().mockResolvedValue([
    {
      key: "cache:1",
      route: "/api/integrations/github/stars",
      data: '{"stars":42}',
      fetchedAt: 123,
      ttlSeconds: 300,
    },
  ]),
  set: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};

const mockGitHubStarHistoryRepo = {
  listRepoKeys: vi.fn().mockResolvedValue(["owner/repo"]),
  getDaily: vi.fn().mockResolvedValue([
    {
      repoKey: "owner/repo",
      day: "2026-04-08",
      totalStars: 42,
      starsGained: 2,
      source: "api",
      updatedAt: 123,
    },
  ]),
  getSyncStates: vi.fn().mockResolvedValue([
    {
      repoKey: "owner/repo",
      backfillStatus: "complete",
      nextPage: null,
      oldestSeenStarredAt: null,
      lastSyncedAt: 123,
      lastError: null,
      updatedAt: 123,
    },
  ]),
  getStarEvents: vi.fn().mockResolvedValue([
    {
      sourceEventId: "evt-1",
      repoKey: "owner/repo",
      action: "created",
      userLogin: "alice",
      occurredAt: 123,
      updatedAt: 123,
    },
  ]),
  getTrackingStates: vi.fn().mockResolvedValue([
    {
      repoKey: "owner/repo",
      trackingStartedAt: 120,
      baselineStars: 40,
      lastWebhookAt: 123,
      updatedAt: 123,
    },
  ]),
  upsertDaily: vi.fn().mockResolvedValue(undefined),
  upsertSyncState: vi.fn().mockResolvedValue(undefined),
  upsertStarEvents: vi.fn().mockResolvedValue(undefined),
  upsertTrackingState: vi.fn().mockResolvedValue(undefined),
  clearAll: vi.fn().mockResolvedValue(undefined),
};

function makeRequest(data: unknown): Request {
  return new Request("http://localhost/api/system/database/import", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettingsRepo).mockReturnValue(mockSettingsRepo as never);
  vi.mocked(getCredentialRepo).mockReturnValue(mockCredentialRepo as never);
  vi.mocked(getPluginRepo).mockReturnValue(mockPluginRepo as never);
  vi.mocked(getCacheRepo).mockReturnValue(mockCacheRepo as never);
  vi.mocked(getGitHubStarHistoryRepo).mockReturnValue(mockGitHubStarHistoryRepo as never);
});

describe("GET /api/system/database/export", () => {
  it("returns a versioned full backup artifact with secrets and local data", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe("3");
    expect(body.sourceProvider).toBe("sqlite");
    expect(body.settings.projectOrder).toEqual(["project-a"]);
    expect(body.credentials).toEqual([
      { key: "github", values: { token: "gh-secret" } },
      { key: "vercel", values: { accessToken: "vercel-secret" } },
    ]);
    expect(body.pluginData).toEqual({
      notes: [{ key: "note-1", value: '{"title":"Hello"}' }],
    });
    expect(body.cache).toHaveLength(1);
    expect(body.githubStarHistory.daily).toHaveLength(1);
    expect(body.metadata.omittedDomains).toContain("assistantHistory");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="radarboard-full-backup-\d{4}-\d{2}-\d{2}\.json"$/
    );
  });
});

describe("POST /api/system/database/import", () => {
  it("replaces portable stores when mode is replace", async () => {
    const backup = {
      version: "3",
      exportedAt: new Date().toISOString(),
      sourceProvider: "sqlite",
      settings: {
        projectOrder: ["project-b"],
        featurePreferences: { darkMode: false },
        workflows: { "wf-2": { name: "Ship" } },
      },
      credentials: [{ key: "openpanel", values: { clientId: "cid", clientSecret: "secret" } }],
      pluginData: {
        notes: [{ key: "note-2", value: '{"title":"Imported"}' }],
      },
      cache: [
        {
          key: "cache:2",
          route: "/api/integrations/openpanel/data",
          data: '{"visitors":100}',
          fetchedAt: 456,
          ttlSeconds: 600,
        },
      ],
      githubStarHistory: {
        daily: [
          {
            repoKey: "owner/repo",
            day: "2026-04-08",
            totalStars: 99,
            starsGained: 4,
            source: "api",
            updatedAt: 456,
          },
        ],
        syncStates: [],
        starEvents: [],
        trackingStates: [],
      },
    };

    const response = await POST(makeRequest({ mode: "replace", backup }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe("replace");
    expect(mockSettingsRepo.setProjectOrder).toHaveBeenCalledWith(["project-b"]);
    expect(mockSettingsRepo.setFeaturePreferences).toHaveBeenCalledWith({ darkMode: false });
    expect(mockSettingsRepo.setWorkflows).toHaveBeenCalledWith({ "wf-2": { name: "Ship" } });
    expect(mockCredentialRepo.deleteCredential).toHaveBeenCalledWith("github");
    expect(mockCredentialRepo.deleteCredential).toHaveBeenCalledWith("vercel");
    expect(mockCredentialRepo.setCredential).toHaveBeenCalledWith("openpanel", {
      clientId: "cid",
      clientSecret: "secret",
    });
    expect(mockCacheRepo.clear).toHaveBeenCalled();
    expect(mockPluginRepo.delete).toHaveBeenCalledWith("notes", "note-1");
    expect(mockGitHubStarHistoryRepo.clearAll).toHaveBeenCalled();
    expect(body.restartRecommended).toBe(true);
    expect(body.warnings[0]).toContain("Assistant chat history");
  });

  it("merges settings and portable stores when mode is merge", async () => {
    const response = await POST(
      makeRequest({
        mode: "merge",
        backup: {
          version: "3",
          exportedAt: new Date().toISOString(),
          sourceProvider: "sqlite",
          settings: {
            projectOrder: ["project-b"],
            projectIntegrations: { "project-b": { github: { repo: "bar/baz" } } },
            integrationConnections: [{ id: "conn-2", provider: "vercel" }],
            projectContextMap: { "project-b": { goal: "Launch" } },
            featurePreferences: { compactMode: true },
            llmConfig: { extractionPrompt: "Extract" },
            debugConfig: { metadataRedactionEnabled: true },
            routingConfig: { rules: [{ id: "rule-2", name: "Rule 2" }] },
            workflows: { "wf-2": { name: "Ship" } },
          },
          credentials: [{ key: "github", values: { token: "new-secret" } }],
          pluginData: {
            notes: [{ key: "note-2", value: '{"title":"Merged"}' }],
          },
          cache: [],
          githubStarHistory: {
            daily: [],
            syncStates: [
              {
                repoKey: "owner/repo",
                backfillStatus: "complete",
                nextPage: null,
                oldestSeenStarredAt: null,
                lastSyncedAt: 456,
                lastError: null,
                updatedAt: 456,
              },
            ],
            starEvents: [],
            trackingStates: [],
          },
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSettingsRepo.setProjectOrder).toHaveBeenCalledWith(["project-a", "project-b"]);
    expect(mockSettingsRepo.setProjectIntegrations).toHaveBeenCalledWith({
      "project-a": { github: { repo: "foo/bar" } },
      "project-b": { github: { repo: "bar/baz" } },
    });
    expect(mockSettingsRepo.setIntegrationConnections).toHaveBeenCalledWith([
      { id: "conn-1", provider: "github" },
      { id: "conn-2", provider: "vercel" },
    ]);
    expect(mockCredentialRepo.deleteCredential).not.toHaveBeenCalled();
    expect(mockCacheRepo.clear).not.toHaveBeenCalled();
    expect(mockGitHubStarHistoryRepo.clearAll).not.toHaveBeenCalled();
    expect(mockGitHubStarHistoryRepo.upsertSyncState).toHaveBeenCalled();
    expect(body.errors).toEqual([]);
  });

  it("rejects unsupported backup versions", async () => {
    const response = await POST(
      makeRequest({
        mode: "replace",
        backup: {
          version: "99",
        },
      })
    );

    expect(response.status).toBe(400);
  });
});
