import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllInstalledExtensionsMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/db/sqlite-installed-extensions", () => ({
  getAllInstalledExtensions: (...args: unknown[]) => getAllInstalledExtensionsMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleGetExtensionUpdates as GET } from "@/modules/extensions-shell/routes/updates";

beforeEach(() => {
  getAllInstalledExtensionsMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /api/extensions/updates", () => {
  it("returns empty updates when no extensions installed", async () => {
    getAllInstalledExtensionsMock.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updates).toEqual([]);
  });

  it("detects when an extension has an update available", async () => {
    getAllInstalledExtensionsMock.mockResolvedValue([
      {
        id: "widget-stars",
        githubUrl: "https://github.com/acme/widget-stars",
        commitSha: "abc123",
      },
    ]);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ sha: "def456" }],
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updates).toHaveLength(1);
    expect(body.updates[0]).toMatchObject({
      id: "widget-stars",
      hasUpdate: true,
      currentSha: "abc123",
      latestSha: "def456",
    });
  });

  it("reports no update when SHAs match", async () => {
    getAllInstalledExtensionsMock.mockResolvedValue([
      {
        id: "plugin-notes",
        githubUrl: "https://github.com/acme/plugin-notes",
        commitSha: "abc123",
      },
    ]);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ sha: "abc123" }],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.updates[0].hasUpdate).toBe(false);
  });

  it("handles GitHub API errors gracefully per extension", async () => {
    getAllInstalledExtensionsMock.mockResolvedValue([
      {
        id: "ext-broken",
        githubUrl: "https://github.com/acme/broken",
        commitSha: "abc",
      },
    ]);

    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updates[0].hasUpdate).toBe(false);
    expect(body.updates[0].error).toMatch(/403/);
  });

  it("handles network errors gracefully", async () => {
    getAllInstalledExtensionsMock.mockResolvedValue([
      {
        id: "ext-offline",
        githubUrl: "https://github.com/acme/offline",
        commitSha: "abc",
      },
    ]);

    fetchMock.mockRejectedValue(new Error("Network timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updates[0].hasUpdate).toBe(false);
    expect(body.updates[0].error).toBe("Network timeout");
  });

  it("checks multiple extensions in parallel", async () => {
    getAllInstalledExtensionsMock.mockResolvedValue([
      {
        id: "ext-a",
        githubUrl: "https://github.com/acme/ext-a",
        commitSha: "aaa",
      },
      {
        id: "ext-b",
        githubUrl: "https://github.com/acme/ext-b",
        commitSha: "bbb",
      },
    ]);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ sha: "new_sha" }],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.updates).toHaveLength(2);
    expect(body.updates.every((u: { hasUpdate: boolean }) => u.hasUpdate)).toBe(true);
  });

  it("returns 500 when getAllInstalledExtensions throws", async () => {
    getAllInstalledExtensionsMock.mockRejectedValue(new Error("DB locked"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB locked");
  });
});
