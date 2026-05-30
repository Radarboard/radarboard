import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheRepo = {
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
};

vi.mock("@/db/repository", () => ({
  getCacheRepo: vi.fn(() => mockCacheRepo),
}));

vi.mock("@/db/cache", () => ({
  withCache: vi.fn().mockResolvedValue({ data: {} }),
  deleteExpiredCache: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/backup-tasks", () => ({
  buildBackupTasks: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/polling-settings", () => ({
  getDashboardPollingPreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/config/projects", () => ({
  PROJECTS: [],
}));

import type { BackupManifest } from "@/modules/backup-shell/routes/backup";
import { getLatestBackupManifest, handleRunBackup } from "@/modules/backup-shell/routes/backup";

const GLOBAL_KEY = "__radarboard_backup_manifest__";
const MOCK_SECRET = "test-secret";

function makeRequest(): Request {
  return new Request("http://localhost/api/backup", {
    method: "POST",
    headers: { authorization: `Bearer ${MOCK_SECRET}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BACKUP_SECRET = MOCK_SECRET;
  // Clear globalThis manifest
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
});

afterEach(() => {
  delete process.env.BACKUP_SECRET;
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
});

describe("backup manifest persistence", () => {
  it("persists manifest to cache repo after backup run", async () => {
    await handleRunBackup(makeRequest());

    expect(mockCacheRepo.set).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "system:backup-manifest",
        route: "/api/system/backup/manifest",
      })
    );

    // Verify the persisted data is valid JSON containing manifest fields
    const callArgs = mockCacheRepo.set.mock.calls[0][0];
    const persisted = JSON.parse(callArgs.data);
    expect(persisted).toHaveProperty("timestamp");
    expect(persisted).toHaveProperty("totalTasks");
    expect(persisted).toHaveProperty("refreshed");
    expect(persisted).toHaveProperty("failed");
  });

  it("returns manifest from globalThis when available", async () => {
    const fakeManifest: BackupManifest = {
      timestamp: Date.now(),
      durationMs: 100,
      totalTasks: 5,
      refreshed: 5,
      failed: 0,
      expiredDeleted: 0,
      taskHashes: [],
      errors: [],
    };
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = fakeManifest;

    const result = await getLatestBackupManifest();

    expect(result).toEqual(fakeManifest);
    // Should not hit the database
    expect(mockCacheRepo.get).not.toHaveBeenCalled();
  });

  it("falls back to cache repo when globalThis is empty", async () => {
    const storedManifest: BackupManifest = {
      timestamp: 1700000000000,
      durationMs: 200,
      totalTasks: 3,
      refreshed: 2,
      failed: 1,
      expiredDeleted: 0,
      taskHashes: [{ key: "health", route: "/api/health", sha256: "abc123" }],
      errors: ["sentry failed"],
    };

    mockCacheRepo.get.mockResolvedValue({
      key: "system:backup-manifest",
      route: "/api/system/backup/manifest",
      data: JSON.stringify(storedManifest),
      fetchedAt: 1700000000,
      ttlSeconds: 86400,
    });

    const result = await getLatestBackupManifest();

    expect(result).toEqual(storedManifest);
    expect(mockCacheRepo.get).toHaveBeenCalledWith("system:backup-manifest");
  });

  it("warms globalThis after reading from cache", async () => {
    const storedManifest: BackupManifest = {
      timestamp: 1700000000000,
      durationMs: 100,
      totalTasks: 1,
      refreshed: 1,
      failed: 0,
      expiredDeleted: 0,
      taskHashes: [],
      errors: [],
    };

    mockCacheRepo.get.mockResolvedValue({
      key: "system:backup-manifest",
      data: JSON.stringify(storedManifest),
      fetchedAt: 1700000000,
      ttlSeconds: 86400,
    });

    // First call reads from DB
    await getLatestBackupManifest();
    mockCacheRepo.get.mockClear();

    // Second call should use globalThis (no DB read)
    const result = await getLatestBackupManifest();
    expect(result).toEqual(storedManifest);
    expect(mockCacheRepo.get).not.toHaveBeenCalled();
  });

  it("returns null when neither globalThis nor cache has manifest", async () => {
    mockCacheRepo.get.mockResolvedValue(null);

    const result = await getLatestBackupManifest();

    expect(result).toBeNull();
  });

  it("returns null when cache read fails", async () => {
    mockCacheRepo.get.mockRejectedValue(new Error("DB down"));

    const result = await getLatestBackupManifest();

    expect(result).toBeNull();
  });
});
