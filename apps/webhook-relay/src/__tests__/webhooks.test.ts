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

vi.mock("../lib/store.js", () => ({
  storeEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/sentry.js", () => ({
  captureWarning: vi.fn(),
}));

const mockRedis = {
  set: vi.fn().mockResolvedValue("OK"),
  zadd: vi.fn().mockResolvedValue(1),
};

describe("POST /api/webhooks/:integration", () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_GITHUB = "test-github-secret";
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET_GITHUB;
    delete process.env.RELAY_ENABLED;
    vi.restoreAllMocks();
  });

  async function createApp() {
    const { webhooksRoute } = await import("../routes/webhooks.js");
    const app = new Hono();
    app.route("/api/webhooks", webhooksRoute(mockRedis as any));
    return app;
  }

  it("returns 404 when no provider webhook handlers are registered", async () => {
    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unknown integration");
  });
});
