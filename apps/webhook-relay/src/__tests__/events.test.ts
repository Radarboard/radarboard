import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    async limit() {
      return { success: true, reset: Date.now() + 60000 };
    }
  },
}));

const sampleRelayEvent = {
  id: "evt-1",
  integration: "github",
  event: {
    source: "github",
    type: "pr.opened",
    severity: "info",
    title: "PR #1 opened",
  },
  receivedAt: Date.now(),
};

vi.mock("../lib/store.js", () => ({
  getEventsSince: vi.fn().mockResolvedValue([sampleRelayEvent]),
  pruneExpiredEvents: vi.fn().mockResolvedValue(undefined),
}));

const mockRedis = {};

const POLL_SECRET = "test-poll-secret";

describe("GET /api/events", () => {
  beforeEach(() => {
    process.env.RELAY_POLL_SECRET = POLL_SECRET;
  });

  afterEach(() => {
    delete process.env.RELAY_POLL_SECRET;
    vi.restoreAllMocks();
  });

  async function createApp() {
    const { eventsRoute } = await import("../routes/events.js");
    const app = new Hono();
    app.route("/api/events", eventsRoute(mockRedis as any));
    return app;
  }

  it("should return 401 without authorization header", async () => {
    const app = await createApp();
    const res = await app.request("/api/events");
    expect(res.status).toBe(401);
  });

  it("should return 401 with invalid token", async () => {
    const app = await createApp();
    const res = await app.request("/api/events", {
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("should return events with valid auth", async () => {
    const app = await createApp();
    const res = await app.request("/api/events?since=0", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].integration).toBe("github");
  });

  it("should include X-Relay-Timestamp header", async () => {
    const app = await createApp();
    const res = await app.request("/api/events?since=0", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });
    const ts = res.headers.get("X-Relay-Timestamp");
    expect(ts).toBeDefined();
    expect(Number(ts)).toBeGreaterThan(0);
  });

  it("should respect since and limit params", async () => {
    const { getEventsSince } = await import("../lib/store.js");
    const app = await createApp();

    await app.request("/api/events?since=1700000000000&limit=50", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });

    expect(getEventsSince).toHaveBeenCalledWith(expect.anything(), 1700000000000, 50, "_default");
  });

  it("should cap limit at 500", async () => {
    const { getEventsSince } = await import("../lib/store.js");
    const app = await createApp();

    await app.request("/api/events?since=0&limit=9999", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });

    expect(getEventsSince).toHaveBeenCalledWith(expect.anything(), 0, 500, "_default");
  });

  it("should return 502 when Redis is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getEventsSince } = await import("../lib/store.js");
    vi.mocked(getEventsSince).mockRejectedValueOnce(new Error("Redis down"));

    const app = await createApp();
    const res = await app.request("/api/events?since=0", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Event store unavailable");
  });

  it("should return 400 for negative since parameter", async () => {
    const app = await createApp();
    const res = await app.request("/api/events?since=-1", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 for zero limit", async () => {
    const app = await createApp();
    const res = await app.request("/api/events?since=0&limit=0", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid query parameters", async () => {
    const app = await createApp();
    const res = await app.request("/api/events?since=notanumber", {
      headers: { authorization: `Bearer ${POLL_SECRET}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });
});
