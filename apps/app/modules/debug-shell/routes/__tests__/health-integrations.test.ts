import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllHealthSummariesMock = vi.fn();

vi.mock("@/lib/health-tracker", () => ({
  getAllHealthSummaries: (...args: unknown[]) => getAllHealthSummariesMock(...args),
}));

import { handleHealthIntegrations as GET } from "@/modules/debug-shell/routes/health-integrations";

beforeEach(() => {
  getAllHealthSummariesMock.mockReset();
});

describe("GET /api/dev/health/integrations", () => {
  it("returns healthy status when all sources are healthy", async () => {
    getAllHealthSummariesMock.mockReturnValue([
      { id: "github", status: "healthy", lastSuccess: 1700000000 },
      { id: "sentry", status: "healthy", lastSuccess: 1700000000 },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("healthy");
    expect(body.totalSources).toBe(2);
    expect(body.unhealthyCount).toBe(0);
    expect(body.degradedCount).toBe(0);
  });

  it("returns unhealthy when any source is unhealthy", async () => {
    getAllHealthSummariesMock.mockReturnValue([
      { id: "github", status: "healthy" },
      { id: "sentry", status: "unhealthy", lastError: "timeout" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("unhealthy");
    expect(body.unhealthyCount).toBe(1);
  });

  it("returns degraded when sources are degraded but none unhealthy", async () => {
    getAllHealthSummariesMock.mockReturnValue([
      { id: "github", status: "healthy" },
      { id: "vercel", status: "degraded" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("degraded");
    expect(body.degradedCount).toBe(1);
    expect(body.unhealthyCount).toBe(0);
  });

  it("unhealthy takes priority over degraded", async () => {
    getAllHealthSummariesMock.mockReturnValue([
      { id: "github", status: "degraded" },
      { id: "sentry", status: "unhealthy" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("unhealthy");
  });

  it("returns healthy with empty sources", async () => {
    getAllHealthSummariesMock.mockReturnValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("healthy");
    expect(body.totalSources).toBe(0);
  });

  it("includes source details in response", async () => {
    const sources = [{ id: "github", status: "healthy", lastSuccess: 1700000000 }];
    getAllHealthSummariesMock.mockReturnValue(sources);

    const res = await GET();
    const body = await res.json();

    expect(body.sources).toEqual(sources);
  });
});
