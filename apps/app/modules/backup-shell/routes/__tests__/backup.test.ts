import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheRepo = {
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
};

vi.mock("@/db/repository", () => ({
  getCacheRepo: () => mockCacheRepo,
}));

vi.mock("@/db/cache", () => ({
  withCache: vi.fn(),
  deleteExpiredCache: vi.fn().mockResolvedValue(0),
}));

const getWebEnvMock = vi.fn();
vi.mock("@/lib/env", () => ({
  getWebEnv: (...args: unknown[]) => getWebEnvMock(...args),
}));

const buildBackupTasksMock = vi.fn().mockReturnValue([]);
vi.mock("@/lib/backup-tasks", () => ({
  buildBackupTasks: (...args: unknown[]) => buildBackupTasksMock(...args),
}));

vi.mock("@/lib/polling-settings", () => ({
  getDashboardPollingPreferences: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/config/projects", () => ({
  PROJECTS: [{ slug: "my-app" }],
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { deleteExpiredCache, withCache } from "@/db/cache";
import { getLatestBackupManifest, handleRunBackup } from "../backup";

beforeEach(() => {
  vi.clearAllMocks();
  // Clear globalThis backup manifest
  const g = globalThis as Record<string, unknown>;
  delete g.__radarboard_backup_manifest__;
});

function makeRequest(secret: string): Request {
  return new Request("http://localhost/api/backup", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
}

describe("handleRunBackup", () => {
  it("returns 500 when BACKUP_SECRET is not configured", async () => {
    getWebEnvMock.mockReturnValue(undefined);

    const res = await handleRunBackup(makeRequest("anything"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/BACKUP_SECRET/);
  });

  it("returns 401 when bearer token doesn't match", async () => {
    getWebEnvMock.mockReturnValue("correct-secret");

    const res = await handleRunBackup(makeRequest("wrong-secret"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("runs backup with correct secret and returns manifest", async () => {
    getWebEnvMock.mockReturnValue("my-secret");
    vi.mocked(deleteExpiredCache).mockResolvedValue(5);
    buildBackupTasksMock.mockReturnValue([
      {
        key: "github:stars",
        route: "/api/integrations/github/stars",
        ttlSeconds: 300,
        fetchFn: vi.fn(),
      },
    ]);
    vi.mocked(withCache).mockResolvedValue({ stars: 42 });

    const res = await handleRunBackup(makeRequest("my-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshed).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.expiredDeleted).toBe(5);
    expect(body.errors).toEqual([]);
  });

  it("counts failed tasks and records errors", async () => {
    getWebEnvMock.mockReturnValue("my-secret");
    vi.mocked(deleteExpiredCache).mockResolvedValue(0);
    buildBackupTasksMock.mockReturnValue([
      {
        key: "sentry:test",
        route: "/api/sentry",
        ttlSeconds: 300,
        fetchFn: vi.fn(),
      },
    ]);
    vi.mocked(withCache).mockRejectedValue(new Error("Sentry down"));

    const res = await handleRunBackup(makeRequest("my-secret"));
    const body = await res.json();

    expect(body.refreshed).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("Sentry down");
  });
});

describe("getLatestBackupManifest", () => {
  it("returns null when no backup has been run", async () => {
    const manifest = await getLatestBackupManifest();
    expect(manifest).toBeNull();
  });

  it("returns manifest from in-memory cache", async () => {
    const stored = { timestamp: 1700000000, refreshed: 5, failed: 0 };
    (globalThis as Record<string, unknown>).__radarboard_backup_manifest__ = stored;

    const manifest = await getLatestBackupManifest();
    expect(manifest).toEqual(stored);
  });

  it("falls back to database when in-memory is empty", async () => {
    mockCacheRepo.get.mockResolvedValue({
      data: JSON.stringify({ timestamp: 1700000000, refreshed: 3 }),
    });

    const manifest = await getLatestBackupManifest();
    expect(manifest?.timestamp).toBe(1700000000);
    expect(manifest?.refreshed).toBe(3);
  });

  it("warms in-memory cache after DB read", async () => {
    mockCacheRepo.get.mockResolvedValue({
      data: JSON.stringify({ timestamp: 1700000000 }),
    });

    await getLatestBackupManifest();

    // Second call should use in-memory
    mockCacheRepo.get.mockReset();
    const manifest = await getLatestBackupManifest();
    expect(manifest?.timestamp).toBe(1700000000);
    expect(mockCacheRepo.get).not.toHaveBeenCalled();
  });
});
