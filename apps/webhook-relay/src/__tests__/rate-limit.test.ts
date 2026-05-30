import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

// Track the mock limit function so tests can control the response
const mockLimit = vi.fn();

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    async limit(...args: unknown[]) {
      return mockLimit(...args);
    }
  },
}));

describe("rate-limit middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockLimit.mockReset();
  });

  describe("webhookRateLimit", () => {
    async function createApp() {
      const { webhookRateLimit } = await import("../middleware/rate-limit.js");
      const app = new Hono();
      app.use("/:integration", webhookRateLimit({} as any));
      app.post("/:integration", (c) => c.json({ ok: true }));
      return app;
    }

    it("should pass through when rate limit is not exceeded", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      const res = await app.request("/github", { method: "POST" });
      expect(res.status).toBe(200);
    });

    it("should return 429 when rate limit is exceeded", async () => {
      mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 30000 });
      const app = await createApp();
      const res = await app.request("/github", { method: "POST" });
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("Too many requests");
      expect(res.headers.get("Retry-After")).toBeDefined();
    });

    it("should include IP and integration in rate limit key", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      await app.request("/github", {
        method: "POST",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(mockLimit).toHaveBeenCalledWith("_default:1.2.3.4:github");
    });

    it("should prefer x-vercel-forwarded-for over x-forwarded-for", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      await app.request("/github", {
        method: "POST",
        headers: {
          "x-vercel-forwarded-for": "10.0.0.1",
          "x-forwarded-for": "1.2.3.4",
        },
      });
      expect(mockLimit).toHaveBeenCalledWith("_default:10.0.0.1:github");
    });

    it("should prefer cf-connecting-ip when x-vercel-forwarded-for is missing", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      await app.request("/github", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "172.16.0.1",
          "x-forwarded-for": "1.2.3.4",
        },
      });
      expect(mockLimit).toHaveBeenCalledWith("_default:172.16.0.1:github");
    });

    it("should use first IP from comma-separated x-forwarded-for", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      await app.request("/github", {
        method: "POST",
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
      });
      expect(mockLimit).toHaveBeenCalledWith("_default:1.2.3.4:github");
    });

    it("should fall back to x-real-ip when no other headers are present", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      await app.request("/github", {
        method: "POST",
        headers: { "x-real-ip": "10.0.0.1" },
      });
      expect(mockLimit).toHaveBeenCalledWith("_default:10.0.0.1:github");
    });

    it("should use 'unknown' when no IP headers are present", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      await app.request("/github", { method: "POST" });
      expect(mockLimit).toHaveBeenCalledWith("_default:unknown:github");
    });

    it("should fail open when Redis is unavailable", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLimit.mockRejectedValue(new Error("Redis connection refused"));
      const app = await createApp();
      const res = await app.request("/github", { method: "POST" });
      expect(res.status).toBe(200);
    });

    it("should include Retry-After header with correct seconds", async () => {
      const resetMs = Date.now() + 15000; // 15 seconds from now
      mockLimit.mockResolvedValue({ success: false, reset: resetMs });
      const app = await createApp();
      const res = await app.request("/github", { method: "POST" });
      const retryAfter = Number(res.headers.get("Retry-After"));
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15);
    });
  });

  describe("pollRateLimit", () => {
    async function createApp() {
      const { pollRateLimit } = await import("../middleware/rate-limit.js");
      const app = new Hono();
      app.use("/", pollRateLimit({} as any));
      app.get("/", (c) => c.json({ ok: true }));
      return app;
    }

    it("should pass through when rate limit is not exceeded", async () => {
      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
      const app = await createApp();
      const res = await app.request("/");
      expect(res.status).toBe(200);
    });

    it("should fail open when Redis is unavailable for poll", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLimit.mockRejectedValue(new Error("Redis timeout"));
      const app = await createApp();
      const res = await app.request("/");
      expect(res.status).toBe(200);
    });

    it("should return 429 when poll rate limit is exceeded", async () => {
      mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 30000 });
      const app = await createApp();
      const res = await app.request("/");
      expect(res.status).toBe(429);
    });
  });
});
