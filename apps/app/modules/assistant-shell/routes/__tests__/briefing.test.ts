import { beforeEach, describe, expect, it, vi } from "vitest";

const getFeatureServerRouteMock = vi.fn();
const routeHandlerMock = vi.fn();

vi.mock("@/lib/extensions/runtime/server/feature-server", () => ({
  getFeatureServerRoute: (...args: unknown[]) => getFeatureServerRouteMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleGetBriefing as GET } from "@/modules/assistant-shell/routes/briefing";

beforeEach(() => {
  getFeatureServerRouteMock.mockReset();
  routeHandlerMock.mockReset();
});

describe("GET /api/briefing", () => {
  it("returns briefing when generation succeeds", async () => {
    const briefing = {
      summary: "All systems operational",
      sections: [{ title: "GitHub", highlights: ["3 PRs merged"] }],
    };
    getFeatureServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockResolvedValue({ status: 200, payload: briefing });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toBe("All systems operational");
    expect(body.sections).toHaveLength(1);
  });

  it("returns error status when getBriefingRoute fails", async () => {
    getFeatureServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockResolvedValue({
      status: 503,
      payload: { error: "No LLM provider configured" },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("No LLM provider configured");
  });

  it("delegates to the registered briefing feature route", async () => {
    getFeatureServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockResolvedValue({ status: 200, payload: {} });

    await GET();

    expect(getFeatureServerRouteMock).toHaveBeenCalledWith("briefing", "briefing");
    expect(routeHandlerMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: {},
    });
  });

  it("returns 500 on unexpected error", async () => {
    getFeatureServerRouteMock.mockReturnValue(routeHandlerMock);
    routeHandlerMock.mockRejectedValue(new Error("LLM timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to generate briefing");
  });
});
