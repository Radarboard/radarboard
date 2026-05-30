import { beforeEach, describe, expect, it, vi } from "vitest";

const getBriefingRouteMock = vi.fn();

vi.mock("@radarboard/feature-briefing", () => ({
  getBriefingRoute: (...args: unknown[]) => getBriefingRouteMock(...args),
}));

vi.mock("@/db/repository", () => ({
  getCredentialRepo: () => ({
    listCredentialKeys: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("@/lib/data-source-context", () => ({
  buildDataSourceContext: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  emitNotificationEvents: vi.fn(),
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
  getBriefingRouteMock.mockReset();
});

describe("GET /api/briefing", () => {
  it("returns briefing when generation succeeds", async () => {
    const briefing = {
      summary: "All systems operational",
      sections: [{ title: "GitHub", highlights: ["3 PRs merged"] }],
    };
    getBriefingRouteMock.mockResolvedValue({ ok: true, briefing });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toBe("All systems operational");
    expect(body.sections).toHaveLength(1);
  });

  it("returns error status when getBriefingRoute fails", async () => {
    getBriefingRouteMock.mockResolvedValue({
      ok: false,
      error: "No LLM provider configured",
      status: 503,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("No LLM provider configured");
  });

  it("passes required dependencies to getBriefingRoute", async () => {
    getBriefingRouteMock.mockResolvedValue({ ok: true, briefing: {} });

    await GET();

    expect(getBriefingRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        listCredentialKeys: expect.any(Function),
        buildDataSourceContext: expect.any(Function),
        emitNotificationEvents: expect.any(Function),
        onSourceError: expect.any(Function),
      })
    );
  });

  it("returns 500 on unexpected error", async () => {
    getBriefingRouteMock.mockRejectedValue(new Error("LLM timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to generate briefing");
  });
});
