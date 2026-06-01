import { beforeEach, describe, expect, it, vi } from "vitest";

const getPluginServerRouteMock = vi.fn();
const routeHandlerMock = vi.fn();

vi.mock("@/lib/extensions/runtime/server/plugin-server", () => ({
  getPluginServerRoute: (...args: unknown[]) => getPluginServerRouteMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleEmbeddings as POST } from "@/modules/assistant-shell/routes/embeddings";

beforeEach(() => {
  getPluginServerRouteMock.mockReset();
  routeHandlerMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/embeddings", () => {
  it("returns 404 when the embeddings plugin route is unavailable", async () => {
    getPluginServerRouteMock.mockReturnValue(null);

    const res = await POST(makeRequest({ action: "embed", text: "hello" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not registered/i);
  });

  it("delegates to the plugin-owned route when registered", async () => {
    getPluginServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockResolvedValue({
      status: 200,
      payload: { embeddings: [[0.1, 0.2, 0.3]] },
    });

    const res = await POST(makeRequest({ action: "embed", text: "hello" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    expect(getPluginServerRouteMock).toHaveBeenCalledWith("embeddings", "embeddings");
    expect(routeHandlerMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: expect.objectContaining({ action: "embed", text: "hello" }),
    });
  });

  it("returns status from the plugin-owned route", async () => {
    getPluginServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockResolvedValue({
      status: 400,
      payload: { error: "Missing text field" },
    });

    const res = await POST(makeRequest({ action: "embed" }));

    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected error", async () => {
    getPluginServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockRejectedValue(new Error("Config parse error"));

    const res = await POST(makeRequest({ action: "embed" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Config parse error");
  });
});
