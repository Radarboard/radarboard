import { afterEach, describe, expect, it } from "vitest";
import { getAllHealthSummaries, recordHealth, resetHealthData, summarize } from "../health-tracker";

afterEach(() => {
  resetHealthData();
});

describe("health-tracker", () => {
  describe("recordHealth / summarize", () => {
    it("returns null for unknown keys", () => {
      expect(summarize("unknown/key")).toBeNull();
    });

    it("tracks a single success", () => {
      recordHealth("github/data", true, 120);
      const summary = summarize("github/data");

      expect(summary).not.toBeNull();
      expect(summary?.totalRequests).toBe(1);
      expect(summary?.successCount).toBe(1);
      expect(summary?.failureCount).toBe(0);
      expect(summary?.availabilityPct).toBe(100);
      expect(summary?.avgLatencyMs).toBe(120);
      expect(summary?.status).toBe("healthy");
    });

    it("tracks a single failure", () => {
      recordHealth("github/data", false, 5000, "timeout");
      const summary = summarize("github/data");

      expect(summary?.totalRequests).toBe(1);
      expect(summary?.successCount).toBe(0);
      expect(summary?.failureCount).toBe(1);
      expect(summary?.availabilityPct).toBe(0);
      expect(summary?.status).toBe("unhealthy");
      expect(summary?.lastFailure?.error).toBe("timeout");
    });

    it("computes mixed availability correctly", () => {
      // 8 successes, 2 failures = 80% availability = degraded
      for (let i = 0; i < 8; i++) {
        recordHealth("linear/data", true, 100);
      }
      recordHealth("linear/data", false, 3000, "err1");
      recordHealth("linear/data", false, 4000, "err2");

      const summary = summarize("linear/data");
      expect(summary?.totalRequests).toBe(10);
      expect(summary?.availabilityPct).toBe(80);
      expect(summary?.status).toBe("degraded");
    });

    it("reports healthy at 90%+ availability", () => {
      for (let i = 0; i < 9; i++) {
        recordHealth("vercel/data", true, 50);
      }
      recordHealth("vercel/data", false, 1000);

      const summary = summarize("vercel/data");
      expect(summary?.availabilityPct).toBe(90);
      expect(summary?.status).toBe("healthy");
    });

    it("reports unhealthy below 50%", () => {
      recordHealth("sentry/data", true, 100);
      recordHealth("sentry/data", false, 200);
      recordHealth("sentry/data", false, 300);
      recordHealth("sentry/data", false, 400);

      const summary = summarize("sentry/data");
      expect(summary?.availabilityPct).toBe(25);
      expect(summary?.status).toBe("unhealthy");
    });

    it("computes avg and p95 latency from successes only", () => {
      recordHealth("npm/data", true, 100);
      recordHealth("npm/data", true, 200);
      recordHealth("npm/data", true, 300);
      recordHealth("npm/data", false, 9000, "timeout");

      const summary = summarize("npm/data");
      expect(summary?.avgLatencyMs).toBe(200); // (100+200+300)/3
      // p95 of 3 items = index 2 = 300
      expect(summary?.p95LatencyMs).toBe(300);
    });

    it("ring buffer wraps after 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        recordHealth("big/source", true, i * 10);
      }

      const summary = summarize("big/source");
      expect(summary?.totalRequests).toBe(50);
    });
  });

  describe("getAllHealthSummaries", () => {
    it("returns empty array when nothing tracked", () => {
      expect(getAllHealthSummaries()).toEqual([]);
    });

    it("returns summaries for all tracked sources sorted by key", () => {
      recordHealth("vercel/data", true, 100);
      recordHealth("github/data", true, 200);
      recordHealth("linear/data", false, 300);

      const summaries = getAllHealthSummaries();
      expect(summaries).toHaveLength(3);
      expect(summaries.map((s) => s.key)).toEqual(["github/data", "linear/data", "vercel/data"]);
    });
  });

  describe("resetHealthData", () => {
    it("clears all tracking data", () => {
      recordHealth("a/b", true, 100);
      resetHealthData();

      expect(summarize("a/b")).toBeNull();
      expect(getAllHealthSummaries()).toEqual([]);
    });
  });
});
