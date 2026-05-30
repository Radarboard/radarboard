import {
  MOCK_GITHUB_ISSUES,
  MOCK_GITHUB_PULLS,
  MOCK_GITHUB_STARS,
  MOCK_HEALTH_CHECKS,
  MOCK_REVENUE,
  MOCK_REVENUE_SERIES,
  MOCK_SEO,
  MOCK_SHIPPING,
  MOCK_VERCEL_DEPLOYMENTS,
  MOCK_VERCEL_DOMAINS,
  MOCK_VERCEL_PROJECTS,
} from "@radarboard/widget-engine/demo";
import { NuqsAdapter } from "nuqs/adapters/next";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { initializeWidgets } from "../../../app/lib/extensions/runtime/widgets-init";
import { DashboardProvider } from "./hooks/use-dashboard";

type StorybookMockScenario = "dashboard-demo" | "default";

let widgetsInitialized = false;
let apiMocksInstalled = false;
let activeMockScenario: StorybookMockScenario = "default";
let originalFetch: typeof globalThis.fetch | null = null;
let originalSendBeacon: typeof navigator.sendBeacon | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getFetchedAt(): number {
  return Math.floor(Date.now() / 1000);
}

function buildRecentDateLabel(daysAgo: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildStarsHistoryResponse() {
  const aggregateAddedDaily = [
    { date: buildRecentDateLabel(6), count: 4 },
    { date: buildRecentDateLabel(5), count: 6 },
    { date: buildRecentDateLabel(4), count: 3 },
    { date: buildRecentDateLabel(3), count: 5 },
    { date: buildRecentDateLabel(2), count: 4 },
    { date: buildRecentDateLabel(1), count: 6 },
    { date: buildRecentDateLabel(0), count: 2 },
  ];

  const aggregateDaily = aggregateAddedDaily.reduce<
    Array<{ date: string; totalStars: number; starsGained: number }>
  >((points, point, index) => {
    const previousTotal =
      index === 0 ? MOCK_GITHUB_STARS.totalStars - 30 : (points[index - 1]?.totalStars ?? 0);
    points.push({
      date: point.date,
      totalStars: previousTotal + point.count,
      starsGained: point.count,
    });
    return points;
  }, []);

  const repoDaily = Object.fromEntries(
    MOCK_GITHUB_STARS.repos.map((repo) => {
      const totalDelta = repo.starsDelta ?? 0;
      const points = aggregateAddedDaily.map((point, index) => {
        const growth =
          index < aggregateAddedDaily.length - 1
            ? Math.floor(totalDelta / aggregateAddedDaily.length)
            : totalDelta;
        const remainingGrowth = index < aggregateAddedDaily.length - 1 ? growth : 0;
        return {
          date: point.date,
          totalStars: repo.stars - Math.max(totalDelta - remainingGrowth, 0),
          starsGained: index === aggregateAddedDaily.length - 1 ? totalDelta : 0,
        };
      });
      return [repo.fullName.toLowerCase(), points];
    })
  );

  const repoAddedDaily = Object.fromEntries(
    MOCK_GITHUB_STARS.repos.map((repo) => [
      repo.fullName.toLowerCase(),
      aggregateAddedDaily.map((point, index) => ({
        date: point.date,
        count: index === aggregateAddedDaily.length - 1 ? (repo.starsDelta ?? 0) : 0,
      })),
    ])
  );

  return {
    configured: true,
    aggregateDaily,
    repoDaily,
    aggregateAddedDaily,
    repoAddedDaily,
    repos: MOCK_GITHUB_STARS.repos.map((repo) => ({
      repoKey: repo.fullName.toLowerCase(),
      fullName: repo.fullName,
      latestStars: repo.stars,
      backfillStatus: "complete" as const,
      lastSyncedAt: getFetchedAt(),
      nextPage: null,
      historyMode: "exact" as const,
      lastError: null,
      trackingStartedAt: getFetchedAt() - 30 * 86_400_000,
      lastWebhookAt: getFetchedAt() - 3_600_000,
      coverageStatus: "full" as const,
      coverageMessage: null,
    })),
    latestSyncAt: getFetchedAt(),
    _fetchedAt: getFetchedAt(),
  };
}

function createCommonStorybookApiResponse(url: URL, method: string): Response | null {
  const pathname = url.pathname;

  if (pathname === "/api/settings") {
    return jsonResponse({});
  }

  if (pathname === "/api/plugins/token" && method === "POST") {
    return jsonResponse({ token: "storybook-plugin-token" });
  }

  if (pathname.startsWith("/api/plugins/data/list")) {
    return jsonResponse({ items: [] });
  }

  if (pathname.startsWith("/api/plugins/data")) {
    return jsonResponse({ value: null });
  }

  if (pathname === "/api/extensions/usage") {
    return new Response(null, { status: 204 });
  }

  if (pathname.startsWith("/api/debug/events")) {
    if (method === "GET") {
      return jsonResponse({ events: [], nextBefore: null, newestOccurredAt: null, total: 0 });
    }

    return new Response(null, { status: 204 });
  }

  return null;
}

function createDisconnectedApiResponse(url: URL): Response | null {
  const pathname = url.pathname;

  if (pathname === "/api/integrations/revenuecat/data") {
    return jsonResponse({
      configured: false,
      revenue: null,
      revenueSeries: [],
      raw: null,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/npm/data") {
    return jsonResponse({
      configured: false,
      totalWeekly: 0,
      totalMonthly: 0,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/github/stars") {
    return jsonResponse({
      configured: false,
      repos: [],
      totalStars: 0,
      totalForks: 0,
      starHistory: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/github/stars-history") {
    return jsonResponse({
      configured: false,
      aggregateDaily: [],
      repoDaily: {},
      aggregateAddedDaily: [],
      repoAddedDaily: {},
      repos: [],
      latestSyncAt: null,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/github/open-prs") {
    return jsonResponse({ configured: false, items: [], _fetchedAt: getFetchedAt() });
  }

  if (pathname === "/api/integrations/github/open-issues") {
    return jsonResponse({ configured: false, items: [], _fetchedAt: getFetchedAt() });
  }

  if (pathname === "/api/analytics/data") {
    return jsonResponse({
      configured: false,
      metrics: [],
      timeseries: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/sentry/data") {
    return jsonResponse({
      configured: false,
      sentry: null,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/betterstack/data") {
    return jsonResponse({
      configured: false,
      checks: [],
      incidents: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/app-store-connect/data") {
    return jsonResponse({
      configured: false,
      appStore: null,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/shipping/data") {
    return jsonResponse({
      configured: false,
      items: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/google-search-console/data") {
    return jsonResponse({
      configured: false,
      seo: null,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/vercel/domains") {
    return jsonResponse({
      configured: false,
      domains: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/vercel/deployments") {
    return jsonResponse({
      configured: false,
      deployments: [],
      projects: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  return null;
}

function createDashboardDemoApiResponse(url: URL): Response | null {
  const pathname = url.pathname;

  if (pathname === "/api/integrations/revenuecat/data") {
    return jsonResponse({
      configured: true,
      revenue: MOCK_REVENUE,
      revenueSeries: MOCK_REVENUE_SERIES,
      raw: null,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/npm/data") {
    return jsonResponse({
      configured: true,
      packages: [
        {
          name: "@radarboard/core",
          weeklyDownloads: 12400,
          monthlyDownloads: 48600,
          version: "2.4.1",
        },
        {
          name: "@radarboard/widget-engine",
          weeklyDownloads: 8200,
          monthlyDownloads: 31500,
          version: "1.7.0",
        },
        {
          name: "@radarboard/plugin-sdk",
          weeklyDownloads: 5600,
          monthlyDownloads: 22100,
          version: "3.1.2",
        },
        {
          name: "@radarboard/themes",
          weeklyDownloads: 3100,
          monthlyDownloads: 12800,
          version: "1.2.0",
        },
      ],
      totalWeekly: 29300,
      totalMonthly: 115000,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/github/stars") {
    return jsonResponse({
      configured: true,
      repos: MOCK_GITHUB_STARS.repos,
      totalStars: MOCK_GITHUB_STARS.totalStars,
      totalForks: MOCK_GITHUB_STARS.totalForks,
      starHistory: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/github/stars-history") {
    return jsonResponse(buildStarsHistoryResponse());
  }

  if (pathname === "/api/integrations/github/open-prs") {
    return jsonResponse({
      configured: true,
      items: MOCK_GITHUB_PULLS,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/github/open-issues") {
    return jsonResponse({
      configured: true,
      items: MOCK_GITHUB_ISSUES,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/betterstack/data") {
    return jsonResponse({
      configured: true,
      checks: MOCK_HEALTH_CHECKS,
      incidents: [],
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/sentry/data") {
    return jsonResponse({
      configured: true,
      sentry: {
        unresolvedCount: 3,
        issues: [
          {
            id: "demo-1",
            title: "TypeError: Cannot read properties of undefined",
            culprit: "app/editor/canvas.tsx",
            count: 42,
            firstSeen: "2026-03-10T08:00:00Z",
            lastSeen: "2026-03-27T12:00:00Z",
            level: "error",
            project: { name: "Pixel Studio", slug: "pixel-studio" },
          },
          {
            id: "demo-2",
            title: "NetworkError: Failed to fetch resource",
            culprit: "lib/api/client.ts",
            count: 18,
            firstSeen: "2026-03-15T10:30:00Z",
            lastSeen: "2026-03-27T11:00:00Z",
            level: "warning",
            project: { name: "Brew Finder", slug: "brew-finder" },
          },
          {
            id: "demo-3",
            title: "RangeError: Maximum call stack size exceeded",
            culprit: "utils/recursive-merge.ts",
            count: 7,
            firstSeen: "2026-03-22T14:00:00Z",
            lastSeen: "2026-03-26T09:30:00Z",
            level: "error",
            project: { name: "Task Flow", slug: "task-flow" },
          },
        ],
        errorTrend: [
          { date: buildRecentDateLabel(6), value: 4 },
          { date: buildRecentDateLabel(5), value: 6 },
          { date: buildRecentDateLabel(4), value: 5 },
          { date: buildRecentDateLabel(3), value: 7 },
          { date: buildRecentDateLabel(2), value: 3 },
          { date: buildRecentDateLabel(1), value: 4 },
          { date: buildRecentDateLabel(0), value: 3 },
        ],
      },
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/shipping/data") {
    return jsonResponse({
      configured: true,
      items: MOCK_SHIPPING,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/google-search-console/data") {
    return jsonResponse({
      configured: true,
      seo: MOCK_SEO,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/vercel/domains") {
    return jsonResponse({
      configured: true,
      domains: MOCK_VERCEL_DOMAINS,
      _fetchedAt: getFetchedAt(),
    });
  }

  if (pathname === "/api/integrations/vercel/deployments") {
    return jsonResponse({
      configured: true,
      deployments: MOCK_VERCEL_DEPLOYMENTS,
      projects: MOCK_VERCEL_PROJECTS,
      _fetchedAt: getFetchedAt(),
    });
  }

  return null;
}

function createStorybookApiResponse(url: URL, method: string): Response | null {
  const commonResponse = createCommonStorybookApiResponse(url, method);
  if (commonResponse) return commonResponse;

  if (activeMockScenario === "dashboard-demo") {
    return createDashboardDemoApiResponse(url) ?? createDisconnectedApiResponse(url);
  }

  return createDisconnectedApiResponse(url);
}

function ensureStorybookApiMocks() {
  if (apiMocksInstalled || typeof window === "undefined") return;

  originalFetch = globalThis.fetch;
  originalSendBeacon = navigator.sendBeacon.bind(navigator);

  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url, window.location.origin);
    const mocked = createStorybookApiResponse(url, request.method);
    if (mocked) return mocked;
    return (originalFetch as typeof globalThis.fetch)(input, init);
  };

  navigator.sendBeacon = (url) => {
    const target = typeof url === "string" ? url : url.toString();
    if (target.startsWith("/api/debug/events")) return true;
    return (originalSendBeacon as typeof navigator.sendBeacon)(url);
  };

  apiMocksInstalled = true;
}

export function StorybookAppProvider({
  children,
  mockScenario = "default",
}: {
  children: ReactNode;
  mockScenario?: StorybookMockScenario;
}) {
  activeMockScenario = mockScenario;
  ensureStorybookApiMocks();

  useEffect(() => {
    if (widgetsInitialized) return;
    initializeWidgets();
    widgetsInitialized = true;
  }, []);

  return (
    <NuqsAdapter>
      <DashboardProvider>{children}</DashboardProvider>
    </NuqsAdapter>
  );
}
