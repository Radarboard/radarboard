import { beforeAll, describe, expect, it } from "vitest";

// Set dummy env vars before importing the app to prevent console warnings
beforeAll(() => {
  process.env.KV_REST_API_URL = "https://fake-redis.upstash.io";
  process.env.KV_REST_API_TOKEN = "fake-token";
  process.env.RELAY_POLL_SECRET = "test-secret";
  process.env.ALLOWED_ORIGIN = "https://localhost:3000";
});

describe("vercel-entry", () => {
  it("should export a default object with a fetch function", async () => {
    const mod = await import("../vercel-entry.js");
    const entry = mod.default as Record<string, unknown>;
    expect(entry).toBeDefined();
    expect(typeof entry.fetch).toBe("function");
  });
});

describe("cloudflare-entry", () => {
  it("should export a default object with a fetch function", async () => {
    const mod = await import("../cloudflare-entry.js");
    const entry = mod.default as Record<string, unknown>;
    expect(entry).toBeDefined();
    expect(typeof entry.fetch).toBe("function");
  });
});

describe("app (index)", () => {
  it("should export a Hono app with basePath /api", async () => {
    const { app } = await import("../index.js");
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe("function");
  });

  it("should respond to GET /api/health", async () => {
    const { app } = await import("../index.js");
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTypeOf("number");
  });

  it("should return 404 for non-existent routes", async () => {
    const { app } = await import("../index.js");
    const res = await app.request("/api/nonexistent");
    expect(res.status).toBe(404);
  });
});
