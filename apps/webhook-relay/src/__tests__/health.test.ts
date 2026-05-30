import { Hono } from "hono";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  async function createApp() {
    const { healthRoute } = await import("../routes/health.js");
    const app = new Hono();
    app.route("/api/health", healthRoute());
    return app;
  }

  it("should return 200 with status ok", async () => {
    const app = await createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("should include a timestamp", async () => {
    const before = Date.now();
    const app = await createApp();
    const res = await app.request("/api/health");
    const body = await res.json();
    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
