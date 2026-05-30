import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("sentry.ts", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("captureError", () => {
    it("should log error with context to console.error", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { captureError } = await import("../lib/sentry.js");
      const mockContext = {
        req: {
          param: () => "github",
          path: "/api/webhooks/github",
          method: "POST",
          url: "https://example.com/api/webhooks/github",
          header: () => undefined,
        },
      };
      const testError = new Error("boom");
      captureError(testError, mockContext as any);
      expect(spy).toHaveBeenCalledWith("[relay] error", {
        error: "boom",
        stack: expect.stringContaining("Error: boom"),
        path: "/api/webhooks/github",
        method: "POST",
        integration: "github",
      });
    });
  });

  describe("captureWarning", () => {
    it("should log warning to console.warn", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { captureWarning } = await import("../lib/sentry.js");
      captureWarning("prune failed", { error: "timeout" });
      expect(spy).toHaveBeenCalledWith("[relay] warning", "prune failed", { error: "timeout" });
    });
  });

  describe("captureError with non-Error object", () => {
    it("should stringify non-Error values", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { captureError } = await import("../lib/sentry.js");
      const mockContext = {
        req: {
          param: () => undefined,
          path: "/api/webhooks/unknown",
          method: "POST",
          url: "https://example.com/api/webhooks/unknown",
          header: () => undefined,
        },
      };
      captureError("string error", mockContext as any);
      expect(spy).toHaveBeenCalledWith("[relay] error", {
        error: "string error",
        stack: undefined,
        path: "/api/webhooks/unknown",
        method: "POST",
        integration: "unknown",
      });
    });
  });

  describe("flushSentry", () => {
    it("should be a no-op that resolves", async () => {
      const { flushSentry } = await import("../lib/sentry.js");
      await expect(flushSentry()).resolves.toBeUndefined();
    });
  });

  describe("sentryFlushMiddleware", () => {
    it("should pass through without modifying the response", async () => {
      const { sentryFlushMiddleware } = await import("../lib/sentry.js");
      const app = new Hono();
      app.use("*", sentryFlushMiddleware());
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe("sentryMiddleware", () => {
    it("should pass through on success", async () => {
      const { sentryMiddleware } = await import("../lib/sentry.js");
      const app = new Hono();
      app.use("*", sentryMiddleware());
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test");
      expect(res.status).toBe(200);
    });

    it("should re-throw errors after capturing", async () => {
      const { sentryMiddleware } = await import("../lib/sentry.js");
      const app = new Hono();
      app.use("*", sentryMiddleware());
      app.get("/test", () => {
        throw new Error("unhandled");
      });
      app.onError((_err, c) => c.json({ error: "caught" }, 500));

      const res = await app.request("/test");
      expect(res.status).toBe(500);
    });
  });
});
