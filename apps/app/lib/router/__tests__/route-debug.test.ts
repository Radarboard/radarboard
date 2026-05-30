import { beforeEach, describe, expect, it, vi } from "vitest";

const emitDebugEventMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: (...args: unknown[]) => emitDebugEventMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    error: (...args: unknown[]) => loggerErrorMock(...args),
  }),
}));

import { emitRouteOutcome, runRouteWithDebug } from "../route-debug";

beforeEach(() => {
  emitDebugEventMock.mockReset();
  loggerErrorMock.mockReset();
  emitDebugEventMock.mockResolvedValue("evt-1");
});

describe("runRouteWithDebug", () => {
  it("emits started and completed events for successful responses", async () => {
    const response = await runRouteWithDebug({
      actualPath: "/api/test",
      handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      method: "GET",
      request: new Request("https://example.com/api/test?limit=1"),
      routePath: "/api/test",
    });

    expect(response.status).toBe(200);
    expect(emitDebugEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        source: "api/test",
        eventType: "route.request.started",
      })
    );
    expect(emitDebugEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        source: "api/test",
        eventType: "route.request.completed",
        metadata: expect.objectContaining({
          actualPath: "/api/test",
          httpStatus: 200,
          method: "GET",
          query: { limit: "1" },
          routePath: "/api/test",
        }),
      })
    );
  });

  it("emits rejected events for 4xx responses", async () => {
    const response = await runRouteWithDebug({
      actualPath: "/api/test",
      handler: async () => new Response(JSON.stringify({ error: "bad request" }), { status: 400 }),
      method: "POST",
      request: new Request("https://example.com/api/test", { method: "POST" }),
      routePath: "/api/test",
    });

    expect(response.status).toBe(400);
    expect(emitDebugEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "route.request.rejected",
        metadata: expect.objectContaining({
          httpStatus: 400,
          responsePreview: JSON.stringify({ error: "bad request" }),
        }),
      })
    );
  });

  it("emits failed events for 5xx responses", async () => {
    const response = await runRouteWithDebug({
      actualPath: "/api/test",
      handler: async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
      method: "GET",
      request: new Request("https://example.com/api/test"),
      routePath: "/api/test",
    });

    expect(response.status).toBe(500);
    expect(emitDebugEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "route.request.failed",
        metadata: expect.objectContaining({
          httpStatus: 500,
          responsePreview: JSON.stringify({ error: "boom" }),
        }),
      })
    );
  });

  it("emits failed events and returns a generic 500 when the handler throws", async () => {
    const response = await runRouteWithDebug({
      actualPath: "/api/test",
      handler: async () => {
        throw new Error("kaboom");
      },
      method: "DELETE",
      request: new Request("https://example.com/api/test", { method: "DELETE" }),
      routePath: "/api/test",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    expect(loggerErrorMock).toHaveBeenCalled();
    expect(emitDebugEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "route.request.failed",
        metadata: expect.objectContaining({
          error: "kaboom",
        }),
      })
    );
  });
});

describe("emitRouteOutcome", () => {
  it("emits method-not-allowed events", async () => {
    await emitRouteOutcome({
      actualPath: "/api/test",
      method: "PATCH",
      routePath: "/api/test",
      statusCode: 405,
    });

    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "route.request.method_not_allowed",
        source: "api/test",
        status: "method_not_allowed",
      })
    );
  });
});
