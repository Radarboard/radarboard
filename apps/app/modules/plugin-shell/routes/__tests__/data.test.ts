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

import {
  handleDeletePluginData as DELETE,
  handleGetPluginData as GET,
  handlePutPluginData as PUT,
} from "@/modules/plugin-shell/routes/data";

describe("plugin data route", () => {
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
      new NextRequest("http://localhost/api/plugins/data?pluginId=notes&key=notes:list")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid or missing plugin token",
      code: "FORBIDDEN",
    });
  });

  it("rejects PUT with missing or invalid token", async () => {
    verifyPluginTokenMock.mockReturnValue(false);

    const response = await PUT(
      new Request("http://localhost/api/plugins/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId: "notes", key: "notes:list", value: "[]" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("rejects DELETE with missing or invalid token", async () => {
    verifyPluginTokenMock.mockReturnValue(false);

    const response = await DELETE(
      new Request("http://localhost/api/plugins/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId: "notes", key: "notes:list" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns stored plugin data on GET", async () => {
    getPluginRepoMock.mockReturnValue({
      get: vi.fn().mockResolvedValue('{"items":[1,2,3]}'),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/plugins/data?pluginId=notes&key=notes:list")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ value: '{"items":[1,2,3]}' });
    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "plugin.data.read",
        entityId: "notes",
        status: "completed",
      })
    );
  });

  it("emits a failed debug event when GET cannot read plugin data", async () => {
    getPluginRepoMock.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error("db down")),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/plugins/data?pluginId=notes&key=notes:list")
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to read plugin data",
      code: "INTERNAL_ERROR",
    });
    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "plugin.data.read",
        entityId: "notes",
        status: "failed",
        metadata: expect.objectContaining({
          key: "notes:list",
          error: "Error: db down",
        }),
      })
    );
  });

  it("emits a failed debug event when PUT cannot write plugin data", async () => {
    getPluginRepoMock.mockReturnValue({
      set: vi.fn().mockRejectedValue(new Error("write failed")),
    });

    const response = await PUT(
      new Request("http://localhost/api/plugins/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "notes",
          key: "notes:list",
          value: "[]",
        }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to write plugin data",
      code: "INTERNAL_ERROR",
    });
    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "plugin.data.write",
        entityId: "notes",
        status: "failed",
        metadata: expect.objectContaining({
          key: "notes:list",
          error: "Error: write failed",
        }),
      })
    );
  });

  it("emits a failed debug event when DELETE cannot remove plugin data", async () => {
    getPluginRepoMock.mockReturnValue({
      delete: vi.fn().mockRejectedValue(new Error("delete failed")),
    });

    const response = await DELETE(
      new Request("http://localhost/api/plugins/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "notes",
          key: "notes:list",
        }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to delete plugin data",
      code: "INTERNAL_ERROR",
    });
    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "plugin.data.delete",
        entityId: "notes",
        status: "failed",
        metadata: expect.objectContaining({
          key: "notes:list",
          error: "Error: delete failed",
        }),
      })
    );
  });
});
