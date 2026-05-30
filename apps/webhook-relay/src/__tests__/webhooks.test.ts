import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies before importing the route
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

vi.mock("@radarboard/integration-github/webhook", () => ({
  githubWebhookHandler: {
    verifySignature: vi.fn().mockResolvedValue(true),
    parsePayload: vi.fn().mockResolvedValue([
      {
        source: "github",
        type: "pr.opened",
        severity: "info",
        title: "PR opened",
      },
    ]),
  },
}));

vi.mock("@radarboard/integration-vercel/webhook", () => ({
  vercelWebhookHandler: {
    verifySignature: vi.fn().mockResolvedValue(true),
    parsePayload: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@radarboard/integration-sentry/webhook", () => ({
  sentryWebhookHandler: {
    verifySignature: vi.fn(),
    parsePayload: vi.fn(),
  },
}));

vi.mock("@radarboard/integration-linear/webhook", () => ({
  linearWebhookHandler: {
    verifySignature: vi.fn(),
    parsePayload: vi.fn(),
  },
}));

vi.mock("@radarboard/integration-betterstack/webhook", () => ({
  betterstackWebhookHandler: {
    verifySignature: vi.fn(),
    parsePayload: vi.fn(),
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

const jsonHeaders = { "content-type": "application/json" };

describe("POST /api/webhooks/:integration", () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_GITHUB = "test-github-secret";
    process.env.WEBHOOK_SECRET_VERCEL = "test-vercel-secret";
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET_GITHUB;
    delete process.env.WEBHOOK_SECRET_VERCEL;
    delete process.env.RELAY_ENABLED;
    delete process.env.RELAY_DISABLE_GITHUB;
    vi.restoreAllMocks();
  });

  async function createApp() {
    const { webhooksRoute } = await import("../routes/webhooks.js");
    const app = new Hono();
    app.route("/api/webhooks", webhooksRoute(mockRedis as any));
    return app;
  }

  it("should return 404 for unknown integration", async () => {
    const app = await createApp();
    const res = await app.request("/api/webhooks/unknown", {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unknown integration");
  });

  it("should return 401 when webhook secret is not configured", async () => {
    delete process.env.WEBHOOK_SECRET_GITHUB;
    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: "{}",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(401);
  });

  it("should return 401 when signature is invalid", async () => {
    const { githubWebhookHandler } = await import("@radarboard/integration-github/webhook");
    vi.mocked(githubWebhookHandler.verifySignature).mockResolvedValueOnce(false);

    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: "{}",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("should return 200 and store events on valid request", async () => {
    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: JSON.stringify({ action: "opened" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(body.eventCount).toBe(1);
  });

  it("should return 400 when payload parsing fails", async () => {
    const { githubWebhookHandler } = await import("@radarboard/integration-github/webhook");
    vi.mocked(githubWebhookHandler.parsePayload).mockRejectedValueOnce(new Error("Parse error"));

    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: "not json",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  it("should return 415 when Content-Type is not application/json", async () => {
    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "text/plain" },
    });
    expect(res.status).toBe(415);
  });

  it("should return 503 when global kill switch is active", async () => {
    process.env.RELAY_ENABLED = "false";
    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: "{}",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Relay is disabled");
  });

  it("should return 503 when per-integration kill switch is active", async () => {
    process.env.RELAY_DISABLE_GITHUB = "true";
    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: "{}",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Service temporarily unavailable");
  });

  it("should return 502 when storeEvents fails", async () => {
    const { storeEvents } = await import("../lib/store.js");
    vi.mocked(storeEvents).mockRejectedValueOnce(new Error("Redis down"));

    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: JSON.stringify({ action: "opened" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Failed to store events");
  });

  it("should continue rotation when one secret throws an exception", async () => {
    process.env.WEBHOOK_SECRET_GITHUB = "bad-secret,good-secret";

    const { githubWebhookHandler } = await import("@radarboard/integration-github/webhook");
    // First secret throws, second succeeds
    vi.mocked(githubWebhookHandler.verifySignature)
      .mockRejectedValueOnce(new Error("Crypto error"))
      .mockResolvedValueOnce(true);

    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: JSON.stringify({ action: "opened" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
  });

  it("should support secret rotation with comma-separated secrets", async () => {
    process.env.WEBHOOK_SECRET_GITHUB = "new-secret,old-secret";

    const { githubWebhookHandler } = await import("@radarboard/integration-github/webhook");
    // First secret fails, second succeeds (simulates rotation)
    vi.mocked(githubWebhookHandler.verifySignature)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const app = await createApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: JSON.stringify({ action: "opened" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
  });
});
