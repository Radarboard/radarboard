import { beforeEach, describe, expect, it, vi } from "vitest";

const getLatestBackupManifestMock = vi.fn();

vi.mock("@/modules/backup-shell/routes/backup", () => ({
  getLatestBackupManifest: (...args: unknown[]) => getLatestBackupManifestMock(...args),
}));

import { handleGetBackupManifest as GET } from "@/modules/backup-shell/routes/manifest";

beforeEach(() => {
  getLatestBackupManifestMock.mockReset();
});

describe("GET /api/backup/manifest", () => {
  it("returns the latest backup manifest", async () => {
    const manifest = {
      id: "bk-001",
      createdAt: 1700000000,
      sources: ["settings", "credentials"],
      status: "complete",
    };
    getLatestBackupManifestMock.mockResolvedValue(manifest);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(manifest);
  });

  it("returns 404 when no backup exists", async () => {
    getLatestBackupManifestMock.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/No backup/);
  });
});
