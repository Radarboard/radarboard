import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("replayProtection middleware", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function createApp(mockRedis: Record<string, unknown>) {
    // Dynamic import to avoid module cache issues
    return import("../middleware/replay-protection.js").then(({ replayProtection }) => {
      const app = new Hono();
      app.use("/:integration", replayProtection(mockRedis as any));
      app.post("/:integration", (c) => c.json({ ok: true }));
      return app;
    });
  }

  it("should pass through when no delivery ID header is present", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockRedis = { set: vi.fn() };
    const app = await createApp(mockRedis);
    const res = await app.request("/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should pass through for a new delivery ID", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue("OK") };
    const app = await createApp(mockRedis);
    const res = await app.request("/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "abc-123",
      },
    });
    expect(res.status).toBe(200);
    expect(mockRedis.set).toHaveBeenCalledWith("relay:_default:dedup:github:abc-123", "1", {
      nx: true,
      ex: 300,
    });
  });

  it("should return 409 for a duplicate delivery ID", async () => {
    // SET NX returns null when key already exists
    const mockRedis = { set: vi.fn().mockResolvedValue(null) };
    const app = await createApp(mockRedis);
    const res = await app.request("/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "abc-123",
      },
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Duplicate");
  });

  it("should reject old timestamps for sentry integration", async () => {
    const mockRedis = { set: vi.fn() };
    const app = await createApp(mockRedis);
    // Timestamp 10 minutes ago (in seconds)
    const oldTimestamp = String(Math.floor((Date.now() - 600_000) / 1000));
    const res = await app.request("/sentry", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sentry-hook-timestamp": oldTimestamp,
      },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("replay");
  });

  it("should allow fresh timestamps for sentry integration", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue("OK") };
    const app = await createApp(mockRedis);
    // Timestamp 1 minute ago (in seconds)
    const freshTimestamp = String(Math.floor((Date.now() - 60_000) / 1000));
    const res = await app.request("/sentry", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sentry-hook-timestamp": freshTimestamp,
        "sentry-hook-resource": "issue",
      },
    });
    expect(res.status).toBe(200);
  });

  it("should deduplicate Vercel delivery IDs", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue(null) };
    const app = await createApp(mockRedis);
    const res = await app.request("/vercel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-delivery": "vercel-delivery-123",
      },
    });
    expect(res.status).toBe(409);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "relay:_default:dedup:vercel:vercel-delivery-123",
      "1",
      {
        nx: true,
        ex: 300,
      }
    );
  });

  it("should deduplicate Linear delivery IDs", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue(null) };
    const app = await createApp(mockRedis);
    const res = await app.request("/linear", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "linear-delivery": "linear-id-456",
      },
    });
    expect(res.status).toBe(409);
  });

  it("should deduplicate BetterStack delivery IDs", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue(null) };
    const app = await createApp(mockRedis);
    const res = await app.request("/betterstack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-betterstack-delivery": "bs-delivery-789",
      },
    });
    expect(res.status).toBe(409);
  });

  it("should deduplicate Sentry delivery IDs via resource header", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue(null) };
    const app = await createApp(mockRedis);
    const res = await app.request("/sentry", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sentry-hook-resource": "issue",
        "sentry-hook-timestamp": String(Math.floor(Date.now() / 1000)),
      },
    });
    expect(res.status).toBe(409);
  });

  it("should ignore non-numeric timestamp values", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue("OK") };
    const app = await createApp(mockRedis);
    const res = await app.request("/sentry", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sentry-hook-timestamp": "not-a-number",
        "sentry-hook-resource": "issue",
      },
    });
    // NaN check in isTimestampStale returns false, so request passes through
    expect(res.status).toBe(200);
  });

  it("should not check timestamps for non-sentry integrations", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue("OK") };
    const app = await createApp(mockRedis);
    // GitHub has no timestamp header — should always pass timestamp check
    const res = await app.request("/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "new-delivery-id",
      },
    });
    expect(res.status).toBe(200);
  });

  it("should fail open when Redis is unavailable for dedup", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockRedis = { set: vi.fn().mockRejectedValue(new Error("Redis down")) };
    const app = await createApp(mockRedis);
    const res = await app.request("/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "delivery-123",
      },
    });
    // Should pass through (fail-open) when Redis is unavailable
    expect(res.status).toBe(200);
  });

  it("should pass new delivery IDs for all integrations", async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue("OK") };
    const app = await createApp(mockRedis);

    for (const [integration, header] of [
      ["github", "x-github-delivery"],
      ["vercel", "x-vercel-delivery"],
      ["linear", "linear-delivery"],
      ["betterstack", "x-betterstack-delivery"],
    ] as const) {
      const res = await app.request(`/${integration}`, {
        method: "POST",
        headers: { "content-type": "application/json", [header]: `new-${integration}-id` },
      });
      expect(res.status).toBe(200);
    }
  });
});
