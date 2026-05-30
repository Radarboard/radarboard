/**
 * POST /api/demo/seed
 *
 * Seeds all demo mock data into the database cache so widgets render
 * realistic data without real integrations. Also sets demoMode=true
 * and onboardingCompleted=true in preferences.
 */

import { createLogger } from "@radarboard/logger/logger";
import {
  MOCK_ANALYTICS,
  MOCK_GITHUB_COMMITS,
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
import { NextResponse } from "next/server";
import { getCacheRepo, getSettingsRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";

const log = createLogger("api/demo/seed");

const DEMO_TTL = 31_536_000;
const TIME_RANGES = ["today", "7d", "30d"] as const;

/** The demo seed must write cache entries for every timezone variant the
 *  route handler might resolve. "auto" → normalizeTimeZone → actual IANA zone. */
function getDemoTimezones(): string[] {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Always include UTC (the default fallback) and the detected timezone
  const set = new Set(["UTC", detected]);
  return Array.from(set);
}

interface SeedEntry {
  key: string;
  route: string;
  data: unknown;
}

function buildStarHistoryData() {
  const totalStars = MOCK_GITHUB_STARS.totalStars;
  const totalDelta = MOCK_GITHUB_STARS.repos.reduce((sum, r) => sum + (r.starsDelta ?? 0), 0);
  const days = 30;
  const aggregateDaily: Array<{ date: string; totalStars: number; starsGained: number }> = [];
  const aggregateAddedDaily: Array<{ date: string; count: number }> = [];

  for (let i = days; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dailyGain = Math.max(0, Math.round(totalDelta / days + (Math.random() - 0.5) * 2));
    const starsAtDay = totalStars - Math.round((totalDelta * i) / days);
    aggregateDaily.push({ date, totalStars: starsAtDay, starsGained: dailyGain });
    aggregateAddedDaily.push({ date, count: dailyGain });
  }

  return {
    aggregateDaily,
    aggregateAddedDaily,
    repoDaily: {},
    repoAddedDaily: {},
    repos: MOCK_GITHUB_STARS.repos.map((r) => ({
      fullName: r.fullName,
      coverageStatus: "full" as const,
      backfillStatus: "complete" as const,
      lastError: null,
      nextPage: null,
      historyMode: "webhook" as const,
      trackingStartedAt: "2026-01-01T00:00:00Z",
      lastWebhookAt: null,
      coverageMessage: null,
    })),
    latestSyncAt: Math.floor(Date.now() / 1000),
  };
}

function buildEntries(): SeedEntry[] {
  const entries: SeedEntry[] = [];
  const timezones = getDemoTimezones();

  const revenueData = {
    configured: true,
    revenue: MOCK_REVENUE,
    revenueSeries: MOCK_REVENUE_SERIES,
  };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `revenue:all:${range}:USD:${tz}`,
        route: "/api/integrations/revenuecat/data",
        data: revenueData,
      });
    }
  }

  const deploymentsData = {
    configured: true,
    deployments: MOCK_VERCEL_DEPLOYMENTS,
    projects: MOCK_VERCEL_PROJECTS,
  };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `vercel-deployments:all:${range}:${tz}`,
        route: "/api/integrations/vercel/deployments",
        data: deploymentsData,
      });
    }
  }

  entries.push({
    key: "vercel-domains:all",
    route: "/api/integrations/vercel/domains",
    data: { configured: true, domains: MOCK_VERCEL_DOMAINS },
  });

  entries.push({
    key: "vercel-billing:current-month",
    route: "/api/integrations/vercel/billing",
    data: { configured: true, total: 0, breakdown: [] },
  });

  const starsData = {
    repos: MOCK_GITHUB_STARS.repos,
    totalStars: MOCK_GITHUB_STARS.totalStars,
    totalForks: MOCK_GITHUB_STARS.totalForks,
    starHistory: [],
  };
  entries.push({
    key: "github-stars:all:none",
    route: "/api/integrations/github/stars",
    data: starsData,
  });

  // Star history — daily delta and total star counts (30 days)
  const starsHistoryData = buildStarHistoryData();
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `github-stars-history:all:${range}:${tz}:none`,
        route: "/api/integrations/github/stars-history",
        data: starsHistoryData,
      });
    }
  }

  const prsData = { configured: true, items: MOCK_GITHUB_PULLS };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `github-open-prs:all:${range}:${tz}`,
        route: "/api/integrations/github/open-prs",
        data: prsData,
      });
    }
  }

  const issuesData = { configured: true, items: MOCK_GITHUB_ISSUES };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `github-open-issues:all:${range}:${tz}`,
        route: "/api/integrations/github/open-issues",
        data: issuesData,
      });
    }
  }

  entries.push({
    key: "github-commit-activity:all:",
    route: "/api/integrations/github/commit-activity",
    data: { repos: MOCK_GITHUB_COMMITS.repos },
  });

  entries.push({
    key: "github-billing:current-month",
    route: "/api/integrations/github/billing",
    data: { configured: true, total: 0, breakdown: [] },
  });

  const analyticsData = { configured: true, analytics: MOCK_ANALYTICS };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `analytics:data:all:${range}:${tz}`,
        route: "/api/integrations/openpanel/data",
        data: analyticsData,
      });
    }
  }

  const seoData = { configured: true, seo: MOCK_SEO };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `seo:all:none:${range}:${tz}`,
        route: "/api/integrations/google-search-console/data",
        data: seoData,
      });
    }
  }

  const sentryData = {
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
          project: { name: "pixel-studio", slug: "pixel-studio" },
        },
        {
          id: "demo-2",
          title: "NetworkError: Failed to fetch resource",
          culprit: "lib/api/client.ts",
          count: 18,
          firstSeen: "2026-03-15T10:30:00Z",
          lastSeen: "2026-03-27T11:00:00Z",
          level: "warning",
          project: { name: "brew-finder", slug: "brew-finder" },
        },
        {
          id: "demo-3",
          title: "RangeError: Maximum call stack size exceeded",
          culprit: "utils/recursive-merge.ts",
          count: 7,
          firstSeen: "2026-03-22T14:00:00Z",
          lastSeen: "2026-03-26T09:30:00Z",
          level: "error",
          project: { name: "task-flow", slug: "task-flow" },
        },
      ],
      errorTrend: [],
    },
  };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `sentry:all:${range}:${tz}`,
        route: "/api/integrations/sentry/data",
        data: sentryData,
      });
    }
  }

  entries.push({
    key: "health",
    route: "/api/integrations/betterstack/data",
    data: { configured: true, checks: MOCK_HEALTH_CHECKS, incidents: [] },
  });

  entries.push({
    key: "npm-downloads:all::",
    route: "/api/integrations/npm/data",
    data: {
      configured: true,
      packages: [
        {
          name: "@acme/pixel-sdk",
          weeklyDownloads: 12400,
          monthlyDownloads: 48600,
          version: "2.4.1",
        },
        { name: "@acme/brew-ui", weeklyDownloads: 8200, monthlyDownloads: 31500, version: "1.7.0" },
        {
          name: "@acme/task-core",
          weeklyDownloads: 5600,
          monthlyDownloads: 22100,
          version: "3.1.2",
        },
        {
          name: "@acme/recipe-utils",
          weeklyDownloads: 3100,
          monthlyDownloads: 12800,
          version: "1.2.0",
        },
      ],
      totalWeekly: 29300,
      totalMonthly: 115000,
    },
  });

  const shippingData = { configured: true, items: MOCK_SHIPPING };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `shipping:all:${range}:${tz}`,
        route: "/api/integrations/shipping/data",
        data: shippingData,
      });
    }
  }

  return entries;
}

export async function handleDemoSeed() {
  try {
    const cache = getCacheRepo();
    const settings = getSettingsRepo();
    const now = Math.floor(Date.now() / 1000);

    const entries = buildEntries();
    const seedPromises = entries.map((entry) =>
      cache.set({
        key: entry.key,
        route: entry.route,
        data: JSON.stringify({ ...(entry.data as Record<string, unknown>), _fetchedAt: now }),
        fetchedAt: now,
        ttlSeconds: DEMO_TTL,
      })
    );
    await Promise.all(seedPromises);

    const currentLayout = await settings.getWidgetLayout();
    const updatedLayout = {
      ...currentLayout,
      configs: currentLayout?.configs ?? {},
      preferences: {
        ...currentLayout?.preferences,
        demoMode: true,
        onboardingCompleted: true,
      },
    };
    await settings.setWidgetLayout(updatedLayout);

    return NextResponse.json({
      ok: true,
      seeded: entries.length,
    });
  } catch (error) {
    log.error("Failed to seed demo data", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message, { ok: false });
  }
}
