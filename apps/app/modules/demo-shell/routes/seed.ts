/**
 * POST /api/dev/demo/seed
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

const MOCK_APP_STORE = {
  appName: "Pixel Studio",
  bundleId: "app.pixelstudio.editor",
  averageRating: 4.6,
  totalReviews: 286,
  reviewSummary: {
    text: "Creators praise the canvas workflow and export quality. Recent feedback asks for faster brush previews.",
    territory: "USA",
    platform: "IOS",
    createdAt: "2026-05-28T15:30:00Z",
  },
  latestVersion: "2.4.1",
  latestVersionState: "Ready for Sale",
  latestVersionCreatedAt: "2026-05-24T12:00:00Z",
  recentNegativeReviews: 2,
  recentPositiveReviews: 24,
  releaseRisk: "elevated",
  recentReviews: [
    {
      id: "review-demo-1",
      rating: 5,
      title: "Exactly what I needed",
      body: "Layer export is fast, and the new templates save me a lot of setup time.",
      reviewer: "Maya",
      createdAt: "2026-05-30T10:15:00Z",
      territory: "US",
    },
    {
      id: "review-demo-2",
      rating: 4,
      title: "Great editor, brushes need polish",
      body: "The canvas is excellent. A few brushes still lag on older iPads.",
      reviewer: "SketchLab",
      createdAt: "2026-05-29T16:40:00Z",
      territory: "CA",
    },
    {
      id: "review-demo-3",
      rating: 5,
      title: "Best update yet",
      body: "The export presets made my client workflow much easier.",
      reviewer: "Nora",
      createdAt: "2026-05-27T08:05:00Z",
      territory: "GB",
    },
  ],
};

const MOCK_RAINDROP = {
  configured: true,
  source: "api",
  summary: {
    savedCount: 248,
    totalCollections: 6,
    totalTags: 18,
    recentCount: 5,
  },
  recent: [
    {
      id: 101,
      title: "Canvas rendering performance notes",
      excerpt: "Practical techniques for improving high-resolution canvas drawing.",
      link: "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API",
      domain: "developer.mozilla.org",
      created: "2026-05-30T12:30:00Z",
      lastUpdate: "2026-05-30T12:30:00Z",
      tags: ["canvas", "performance"],
      important: true,
      collectionId: 1,
      collectionTitle: "Product Research",
      collectionUrl: "https://app.raindrop.io/my/1",
      raindropUrl: "https://app.raindrop.io/my/0/item/101",
      coverUrl: null,
    },
    {
      id: 102,
      title: "App Store review response guide",
      excerpt: "Guidelines for responding to critical and positive customer reviews.",
      link: "https://developer.apple.com/help/app-store-connect/manage-app-ratings-and-reviews",
      domain: "developer.apple.com",
      created: "2026-05-29T09:45:00Z",
      lastUpdate: "2026-05-29T09:45:00Z",
      tags: ["app-store", "support"],
      important: false,
      collectionId: 2,
      collectionTitle: "Growth",
      collectionUrl: "https://app.raindrop.io/my/2",
      raindropUrl: "https://app.raindrop.io/my/0/item/102",
      coverUrl: null,
    },
    {
      id: 103,
      title: "Pricing page teardown",
      excerpt: "Examples of simple subscription pricing pages for creator tools.",
      link: "https://stripe.com/resources/more/saas-pricing-models",
      domain: "stripe.com",
      created: "2026-05-28T18:20:00Z",
      lastUpdate: "2026-05-28T18:20:00Z",
      tags: ["pricing", "revenue"],
      important: false,
      collectionId: 2,
      collectionTitle: "Growth",
      collectionUrl: "https://app.raindrop.io/my/2",
      raindropUrl: "https://app.raindrop.io/my/0/item/103",
      coverUrl: null,
    },
    {
      id: 104,
      title: "Release checklist for desktop apps",
      excerpt: "A compact release checklist covering QA, docs, and launch tasks.",
      link: "https://docs.github.com/en/repositories/releasing-projects-on-github",
      domain: "docs.github.com",
      created: "2026-05-27T14:10:00Z",
      lastUpdate: "2026-05-27T14:10:00Z",
      tags: ["release", "shipping"],
      important: true,
      collectionId: 3,
      collectionTitle: "Shipping",
      collectionUrl: "https://app.raindrop.io/my/3",
      raindropUrl: "https://app.raindrop.io/my/0/item/104",
      coverUrl: null,
    },
  ],
  collections: [
    {
      id: 1,
      title: "Product Research",
      count: 84,
      color: "#4f8cff",
      parentId: null,
      lastUpdate: "2026-05-30T12:30:00Z",
      collectionUrl: "https://app.raindrop.io/my/1",
    },
    {
      id: 2,
      title: "Growth",
      count: 62,
      color: "#47c78f",
      parentId: null,
      lastUpdate: "2026-05-29T09:45:00Z",
      collectionUrl: "https://app.raindrop.io/my/2",
    },
    {
      id: 3,
      title: "Shipping",
      count: 41,
      color: "#f5c542",
      parentId: null,
      lastUpdate: "2026-05-27T14:10:00Z",
      collectionUrl: "https://app.raindrop.io/my/3",
    },
  ],
  topTags: [
    { name: "canvas", count: 22 },
    { name: "growth", count: 18 },
    { name: "shipping", count: 15 },
    { name: "pricing", count: 12 },
  ],
};

const MOCK_ROADMAP = {
  configured: true,
  projects: [
    {
      id: "roadmap-demo-1",
      name: "Canvas collaboration beta",
      state: "started",
      progress: 0.72,
      targetDate: "2026-06-18",
      health: "onTrack",
      issueCountDone: 18,
      issueCountInProgress: 5,
      issueCountOpen: 7,
      teams: ["Product"],
    },
    {
      id: "roadmap-demo-2",
      name: "Mobile export presets",
      state: "started",
      progress: 0.46,
      targetDate: "2026-07-02",
      health: "atRisk",
      issueCountDone: 9,
      issueCountInProgress: 4,
      issueCountOpen: 11,
      teams: ["Growth"],
    },
  ],
  inProgressIssues: [
    {
      id: "issue-demo-1",
      identifier: "PIX-124",
      title: "Add layer blending modes to canvas editor",
      url: "https://linear.app/radarboard/issue/PIX-124",
      priority: "high",
      assignee: { name: "Maya Chen", avatarUrl: null },
      projectName: "Canvas collaboration beta",
      projectColor: "#4f8cff",
      startedAt: "2026-05-29T09:00:00Z",
      timeInStarted: "2d",
      labels: [{ name: "editor", color: "#4f8cff" }],
    },
    {
      id: "issue-demo-2",
      identifier: "PIX-141",
      title: "Tune brush preview latency on older tablets",
      url: "https://linear.app/radarboard/issue/PIX-141",
      priority: "medium",
      assignee: { name: "Noah Patel", avatarUrl: null },
      projectName: "Canvas collaboration beta",
      projectColor: "#4f8cff",
      startedAt: "2026-05-30T13:30:00Z",
      timeInStarted: "1d",
      labels: [{ name: "performance", color: "#47c78f" }],
    },
    {
      id: "issue-demo-3",
      identifier: "GRO-88",
      title: "Write App Store screenshot copy for export presets",
      url: "https://linear.app/radarboard/issue/GRO-88",
      priority: "low",
      assignee: { name: "Avery Stone", avatarUrl: null },
      projectName: "Mobile export presets",
      projectColor: "#f5c542",
      startedAt: "2026-05-28T16:15:00Z",
      timeInStarted: "3d",
      labels: [{ name: "launch", color: "#f5c542" }],
    },
  ],
};

const MOCK_GITHUB_SPONSORS = {
  configured: true,
  stats: {
    monthlyIncome: 187500,
    sponsorCount: 42,
    currency: "USD",
  },
  sponsors: [
    {
      login: "pixelcraft",
      name: "PixelCraft Studio",
      avatarUrl: "https://github.com/pixelcraft.png",
      url: "https://github.com/pixelcraft",
      type: "ORGANIZATION",
      tier: { name: "Studio", monthlyPriceInCents: 50000 },
      since: "2026-02-12T00:00:00Z",
      isOneTime: false,
    },
    {
      login: "maya-sketch",
      name: "Maya Sketch",
      avatarUrl: "https://github.com/maya-sketch.png",
      url: "https://github.com/maya-sketch",
      type: "USER",
      tier: { name: "Creator", monthlyPriceInCents: 2500 },
      since: "2026-04-08T00:00:00Z",
      isOneTime: false,
    },
  ],
  tiers: [
    {
      id: "tier-demo-1",
      name: "Creator",
      monthlyPriceInCents: 2500,
      description: "Support the monthly roadmap.",
      isOneTime: false,
      sponsorCount: 31,
    },
    {
      id: "tier-demo-2",
      name: "Studio",
      monthlyPriceInCents: 50000,
      description: "Priority roadmap feedback for studios.",
      isOneTime: false,
      sponsorCount: 11,
    },
  ],
  goal: {
    title: "Fund the collaboration beta",
    targetValue: 250000,
    percentComplete: 75,
  },
  limitedAccess: false,
};

const MOCK_OPEN_COLLECTIVE = {
  configured: true,
  stats: {
    balance: 2840000,
    totalRaised: 9460000,
    totalExpenses: 4130000,
    yearlyBudget: 6480000,
    currency: "USD",
    backersCount: 128,
    contributorsCount: 34,
    sparklineData: [
      { date: "2026-05-18", value: 12000 },
      { date: "2026-05-19", value: 18000 },
      { date: "2026-05-20", value: 15000 },
      { date: "2026-05-21", value: 23000 },
      { date: "2026-05-22", value: 21000 },
      { date: "2026-05-23", value: 26000 },
      { date: "2026-05-24", value: 32000 },
    ],
  },
  recentTransactions: [
    {
      id: "oc-tx-demo-1",
      type: "CREDIT",
      amount: 12500,
      netAmount: 11900,
      currency: "USD",
      description: "Monthly backer contribution",
      createdAt: "2026-05-30T11:00:00Z",
      fromAccount: { name: "Studio North", slug: "studio-north", imageUrl: null },
      toAccount: { name: "Pixel Studio", slug: "pixel-studio" },
    },
    {
      id: "oc-tx-demo-2",
      type: "DEBIT",
      amount: 48000,
      netAmount: 48000,
      currency: "USD",
      description: "Design contractor invoice",
      createdAt: "2026-05-28T17:20:00Z",
      fromAccount: { name: "Pixel Studio", slug: "pixel-studio", imageUrl: null },
      toAccount: { name: "Avery Stone", slug: "avery-stone" },
    },
  ],
  topMembers: [
    {
      id: "oc-member-demo-1",
      role: "BACKER",
      tier: "Studio Backer",
      totalDonated: 180000,
      currency: "USD",
      since: "2026-01-12T00:00:00Z",
      account: {
        name: "Studio North",
        slug: "studio-north",
        imageUrl: null,
        type: "ORGANIZATION",
      },
    },
    {
      id: "oc-member-demo-2",
      role: "CONTRIBUTOR",
      tier: "Creator",
      totalDonated: 62000,
      currency: "USD",
      since: "2026-03-04T00:00:00Z",
      account: {
        name: "Maya Sketch",
        slug: "maya-sketch",
        imageUrl: null,
        type: "INDIVIDUAL",
      },
    },
  ],
};

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: demo seed routes stay centralized so dashboard examples remain consistent.
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

  const appStoreData = { configured: true, appStore: MOCK_APP_STORE };
  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `app-store:all:${range}:${tz}`,
        route: "/api/integrations/app-store-connect/data",
        data: appStoreData,
      });
    }
  }

  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `raindrop:all:${range}:${tz}`,
        route: "/api/integrations/raindrop/data",
        data: MOCK_RAINDROP,
      });
    }
  }

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

  entries.push({
    key: "github-sponsors:demo",
    route: "/api/integrations/github-sponsors/data",
    data: MOCK_GITHUB_SPONSORS,
  });

  for (const range of TIME_RANGES) {
    for (const tz of timezones) {
      entries.push({
        key: `open-collective:front-end-checklist:${range}:${tz}`,
        route: "/api/integrations/open-collective/data",
        data: MOCK_OPEN_COLLECTIVE,
      });
    }
  }

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

  entries.push({
    key: "roadmap:all",
    route: "/api/integrations/linear/roadmap",
    data: MOCK_ROADMAP,
  });

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
