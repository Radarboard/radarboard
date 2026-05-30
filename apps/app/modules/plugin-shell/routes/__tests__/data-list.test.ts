import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPluginRepoMock, emitDebugEventMock, loggerErrorMock, verifyPluginTokenMock } =
  vi.hoisted(() => ({
    getPluginRepoMock: vi.fn(),
    emitDebugEventMock: vi.fn(),
    loggerErrorMock: vi.fn(),
    verifyPluginTokenMock: vi.fn(),
  }));

vi.mock("@/db/repository", () => ({
  getPluginRepo: getPluginRepoMock,
}));

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: emitDebugEventMock,
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: vi.fn(() => ({
    error: loggerErrorMock,
  })),
}));

vi.mock("@/lib/plugin-token", () => ({
  verifyPluginToken: verifyPluginTokenMock,
}));

import { handleListPluginData as GET } from "@/modules/plugin-shell/routes/data-list";

describe("plugin data list route", () => {
  beforeEach(() => {
    getPluginRepoMock.mockReset();
    emitDebugEventMock.mockReset();
    loggerErrorMock.mockReset();
    verifyPluginTokenMock.mockReset();
    verifyPluginTokenMock.mockReturnValue(true);
  });

  it("rejects GET with missing or invalid token", async () => {
    verifyPluginTokenMock.mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/plugins/data/list?pluginId=rss-reader&prefix=rss:")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid or missing plugin token",
      code: "FORBIDDEN",
    });
  });

  it("returns listed plugin data on success", async () => {
    getPluginRepoMock.mockReturnValue({
      list: vi.fn().mockResolvedValue([{ key: "rss:feeds", value: "[]" }]),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/plugins/data/list?pluginId=rss-reader&prefix=rss:")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ key: "rss:feeds", value: "[]" }],
    });
    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "plugin.data.list",
        entityId: "rss-reader",
        status: "completed",
      })
    );
  });

  it("emits a failed debug event when listing plugin data fails", async () => {
    getPluginRepoMock.mockReturnValue({
      list: vi.fn().mockRejectedValue(new Error("list failed")),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/plugins/data/list?pluginId=rss-reader&prefix=rss:")
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to list plugin data",
      code: "INTERNAL_ERROR",
    });
    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "plugin.data.list",
        entityId: "rss-reader",
        status: "failed",
        metadata: expect.objectContaining({
          prefix: "rss:",
          error: "Error: list failed",
        }),
      })
    );
  });
});
