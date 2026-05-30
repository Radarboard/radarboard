import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { bodyLimit, jsonOnly, killSwitch, validateIntegration } from "../middleware/security.js";

describe("validateIntegration", () => {
  const knownIntegrations = new Set(["github", "vercel", "sentry"]);

  function createApp() {
    const app = new Hono();
    app.use("/:integration", validateIntegration(knownIntegrations));
    app.post("/:integration", (c) => c.json({ ok: true }));
    return app;
  }

  it("should pass through for a known integration", async () => {
    const app = createApp();
    const res = await app.request("/github", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("should return 404 for an unknown integration", async () => {
    const app = createApp();
    const res = await app.request("/unknown-service", { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unknown integration");
  });

  it("should reject empty integration param", async () => {
    const app = new Hono();
    // Route without param to simulate missing integration
    app.use("/", validateIntegration(knownIntegrations));
    app.post("/", (c) => c.json({ ok: true }));
    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("killSwitch", () => {
  afterEach(() => {
    delete process.env.RELAY_ENABLED;
    delete process.env.RELAY_DISABLE_GITHUB;
    delete process.env.RELAY_DISABLE_VERCEL;
  });

  function createApp() {
    const app = new Hono();
    app.use("/:integration", killSwitch());
    app.post("/:integration", (c) => c.json({ ok: true }));
    return app;
  }

  it("should pass through when relay is enabled (default)", async () => {
    const app = createApp();
    const res = await app.request("/github", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("should return 503 when RELAY_ENABLED is false", async () => {
    process.env.RELAY_ENABLED = "false";
    const app = createApp();
    const res = await app.request("/github", { method: "POST" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Relay is disabled");
  });

  it("should pass through when RELAY_ENABLED is true", async () => {
    process.env.RELAY_ENABLED = "true";
    const app = createApp();
    const res = await app.request("/github", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("should return 503 when per-integration kill switch is set", async () => {
    process.env.RELAY_DISABLE_GITHUB = "true";
    const app = createApp();
    const res = await app.request("/github", { method: "POST" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Service temporarily unavailable");
  });

  it("should not block other integrations when one is disabled", async () => {
    process.env.RELAY_DISABLE_GITHUB = "true";
    const app = createApp();
    const res = await app.request("/vercel", { method: "POST" });
    expect(res.status).toBe(200);
  });
});

describe("bodyLimit", () => {
  function createApp() {
    const app = new Hono();
    app.use("/", bodyLimit());
    app.post("/", (c) => c.json({ ok: true }));
    return app;
  }

  it("should pass through for small payloads", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-length": "1024" },
    });
    expect(res.status).toBe(200);
  });

  it("should return 413 when Content-Length exceeds 256KB", async () => {
    const app = createApp();
    const oversized = String(256 * 1024 + 1);
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-length": oversized },
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("Payload too large");
  });

  it("should pass through when Content-Length is exactly 256KB", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-length": String(256 * 1024) },
    });
    expect(res.status).toBe(200);
  });

  it("should pass through for small payloads", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      body: '{"ok":true}',
    });
    expect(res.status).toBe(200);
  });

  it("should pass through when no body is sent", async () => {
    const app = createApp();
    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(200);
  });
});

describe("jsonOnly", () => {
  function createApp() {
    const app = new Hono();
    app.use("/", jsonOnly());
    app.post("/", (c) => c.json({ ok: true }));
    return app;
  }

  it("should pass through for application/json", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
  });

  it("should pass through for application/json with charset", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    expect(res.status).toBe(200);
  });

  it("should return 415 for text/plain", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "text/plain" },
    });
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toContain("application/json");
  });

  it("should return 415 when Content-Type header is missing", async () => {
    const app = createApp();
    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(415);
  });

  it("should return 415 for multipart/form-data", async () => {
    const app = createApp();
    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "multipart/form-data" },
    });
    expect(res.status).toBe(415);
  });
});
