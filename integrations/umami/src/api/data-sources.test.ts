import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const getStats = vi.fn();
const getActiveVisitors = vi.fn();
const getPageviews = vi.fn();
const getMetrics = vi.fn();

vi.mock("./client", () => ({
  getStats: (...args: unknown[]) => getStats(...args),
  getActiveVisitors: (...args: unknown[]) => getActiveVisitors(...args),
  getPageviews: (...args: unknown[]) => getPageviews(...args),
  getMetrics: (...args: unknown[]) => getMetrics(...args),
}));

import { umamiBreakdownDataSource, umamiDataSource, umamiPagesDataSource } from "./data-sources";

const stubParams: Record<string, unknown> & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
};

function stubCtx(resolveValue: Record<string, string> | null): DataSourceContext {
  return {
    resolveCredential: vi.fn().mockResolvedValue(resolveValue),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue([]),
  };
}

describe("umami data sources", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getStats.mockReset();
    getActiveVisitors.mockReset();
    getPageviews.mockReset();
    getMetrics.mockReset();
  });

  it("returns configured false when credentials are missing", async () => {
    const ctx = stubCtx(null);

    await expect(umamiDataSource.fetch(stubParams, ctx)).resolves.toEqual({ configured: false });
    await expect(umamiPagesDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
    await expect(umamiBreakdownDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });

  it("normalizes overview, pages, and breakdown data", async () => {
    getStats.mockResolvedValue({
      pageviews: { value: 240, prev: 200 },
      visitors: { value: 120, prev: 100 },
      visits: { value: 180, prev: 160 },
      bounces: { value: 45, prev: 32 },
      totaltime: { value: 7200, prev: 6500 },
    });
    getActiveVisitors.mockResolvedValue({ visitors: 12 });
    getPageviews.mockResolvedValue({
      pageviews: [],
      sessions: [{ x: "2026-03-20T00:00:00.000Z", y: 18 }],
    });
    getMetrics
      .mockResolvedValueOnce([{ x: "/pricing", y: 44 }])
      .mockResolvedValueOnce([{ x: "", y: 20 }])
      .mockResolvedValueOnce([{ x: "/pricing", y: 44 }])
      .mockResolvedValueOnce([{ x: "Canada", y: 18 }])
      .mockResolvedValueOnce([{ x: "Desktop", y: 30 }])
      .mockResolvedValueOnce([{ x: "Chrome", y: 28 }]);

    const ctx = stubCtx({
      apiKey: "umami-key",
      baseUrl: "https://cloud.umami.is",
      websiteId: "site-1",
    });

    await expect(umamiDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: true,
      analytics: {
        liveVisitors: 12,
        metrics: {
          uniqueVisitors: 120,
          totalSessions: 180,
          totalPageViews: 240,
          bounceRate: 25,
          avgSessionDuration: 60,
        },
        topPages: [
          {
            path: "/pricing",
            title: "/pricing",
            sessions: 44,
            bounceRate: 0,
            avgDuration: 0,
          },
        ],
        referrers: [{ name: "Direct", sessions: 20, bounceRate: 0 }],
        visitorTrend: [{ date: "2026-03-20", value: 18 }],
      },
      platforms: [{ id: "site-1", name: "Umami", liveVisitors: 12 }],
    });

    await expect(umamiPagesDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      pages: [
        {
          path: "/pricing",
          title: "/pricing",
          sessions: 44,
          bounceRate: 0,
          avgDuration: 0,
        },
      ],
    });
    await expect(umamiBreakdownDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      countries: [{ x: "Canada", y: 18 }],
      devices: [{ x: "Desktop", y: 30 }],
      browsers: [{ x: "Chrome", y: 28 }],
    });
  });

  it("falls back to zero bounce rate, zero duration, and empty session trends", async () => {
    getStats.mockResolvedValue({
      pageviews: { value: 12, prev: 10 },
      visitors: { value: 0, prev: 0 },
      visits: { value: 0, prev: 0 },
      bounces: { value: 0, prev: 0 },
      totaltime: { value: 300, prev: 200 },
    });
    getActiveVisitors.mockResolvedValue({ visitors: 0 });
    getPageviews.mockResolvedValue({ pageviews: [], sessions: undefined });
    getMetrics.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const ctx = stubCtx({
      apiKey: "umami-key",
      baseUrl: "https://cloud.umami.is",
      websiteId: "site-1",
    });

    await expect(umamiDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: true,
      analytics: {
        liveVisitors: 0,
        metrics: {
          uniqueVisitors: 0,
          totalSessions: 0,
          totalPageViews: 12,
          bounceRate: 0,
          avgSessionDuration: 0,
        },
        topPages: [],
        referrers: [],
        visitorTrend: [],
      },
      platforms: [{ id: "site-1", name: "Umami", liveVisitors: 0 }],
    });
  });
});
