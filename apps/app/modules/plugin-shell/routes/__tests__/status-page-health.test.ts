import { beforeEach, describe, expect, it, vi } from "vitest";

const checkProjectHealthMock = vi.fn();

vi.mock("@radarboard/plugin-status-page/project-health", () => ({
  checkProjectHealth: (...args: unknown[]) => checkProjectHealthMock(...args),
}));

vi.mock("@/config/projects", () => ({
  PROJECTS: [
    { slug: "radarboard", name: "Radarboard" },
    { slug: "companion", name: "Companion App" },
  ],
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("@radarboard/logger/middleware", () => ({
  withLogging: (_name: string, handler: (...args: never[]) => unknown) => handler,
}));

import { handleGetStatusPageHealth as GET } from "@/modules/plugin-shell/routes/status-page-health";

beforeEach(() => {
  checkProjectHealthMock.mockReset();
});

describe("GET /api/plugins/status-page/project-health", () => {
  it("returns health check result for valid params", async () => {
    const healthResult = {
      status: "up",
      responseTime: 120,
      checkedAt: "2026-03-28T10:00:00Z",
    };
    checkProjectHealthMock.mockResolvedValue(healthResult);

    const req = new Request(
      "http://localhost/api/status-page/project-health?projectSlug=radarboard&platformId=web"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("up");
    expect(checkProjectHealthMock).toHaveBeenCalledWith(expect.any(Array), "radarboard", "web");
  });

  it("returns 400 when projectSlug is missing", async () => {
    const req = new Request("http://localhost/api/status-page/project-health?platformId=web");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid/);
  });

  it("returns 400 when platformId is missing", async () => {
    const req = new Request(
      "http://localhost/api/status-page/project-health?projectSlug=radarboard"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when checkProjectHealth returns null", async () => {
    checkProjectHealthMock.mockResolvedValue(null);

    const req = new Request(
      "http://localhost/api/status-page/project-health?projectSlug=unknown&platformId=web"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 even when result contains an error field", async () => {
    const resultWithError = {
      status: "down",
      error: "Connection timeout",
    };
    checkProjectHealthMock.mockResolvedValue(resultWithError);

    const req = new Request(
      "http://localhost/api/status-page/project-health?projectSlug=radarboard&platformId=web"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe("Connection timeout");
  });
});
