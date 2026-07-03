/**
 * POST /api/dev/demo/seed
 *
 * Seeds all demo mock data into the database cache so widgets render
 * realistic data without real integrations. Also sets demoMode=true
 * and onboardingCompleted=true in preferences.
 */

import {
  DEFAULT_DASHBOARD_PAGE_SLUG,
  normalizeDashboardWidgetLayout,
} from "@radarboard/hooks/dashboard-layout";
import { logBuffer } from "@radarboard/logger/log-buffer";
import { createLogger } from "@radarboard/logger/logger";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import type { LogEntry, LogLevel } from "@radarboard/types/logs";
import {
  DEMO_CONFIG,
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
import { BASIC_3X3 } from "@radarboard/widget-engine/layouts";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { NextResponse } from "next/server";
import { getCacheRepo, getSettingsRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { initializeWidgetDescriptors } from "@/lib/widgets-init";

const log = createLogger("api/demo/seed");

const DEMO_TTL = 31_536_000;
const TIME_RANGES = ["today", "7d", "30d"] as const;

const MOCK_LOG_BLUEPRINTS: Array<{
  level: LogLevel;
  source: string;
  message: string;
  projectSlug: string;
  metadata: Record<string, unknown>;
}> = [
  {
    level: "info",
    source: "demo/cache",
    message: "Served demo cache entry for analytics overview",
    projectSlug: "pixel-studio",
    metadata: { route: "/api/integrations/openpanel/data", durationMs: 42, demo: true },
  },
  {
    level: "debug",
    source: "demo/widgets",
    message: "Resolved SEO widget data for all projects",
    projectSlug: "pixel-studio",
    metadata: { widgetId: "seo", rows: 12, demo: true },
  },
  {
    level: "warn",
    source: "demo/sentry",
    message: "Grouped recurring canvas errors into release risk summary",
    projectSlug: "pixel-studio",
    metadata: { unresolved: 3, release: "2.4.1", demo: true },
  },
  {
    level: "info",
    source: "demo/shipping",
    message: "Synced release activity from GitHub pull requests",
    projectSlug: "pixel-studio",
    metadata: { pullRequests: 8, deployments: 5, demo: true },
  },
  {
    level: "debug",
    source: "demo/bookmarks",
    message: "Hydrated bookmark collections from Raindrop seed data",
    projectSlug: "task-flow",
    metadata: { saved: 248, collections: 6, demo: true },
  },
  {
    level: "info",
    source: "demo/sponsorship",
    message: "Combined GitHub Sponsors and Open Collective totals",
    projectSlug: "pixel-studio",
    metadata: { sponsors: 170, currency: "USD", demo: true },
  },
  {
    level: "error",
    source: "demo/revenue",
    message: "Webhook retry queued after stale subscription event",
    projectSlug: "pixel-studio",
    metadata: { provider: "revenuecat", retryInSeconds: 45, demo: true },
  },
  {
    level: "info",
    source: "demo/roadmap",
    message: "Loaded Linear roadmap projects for 3x3 showcase",
    projectSlug: "task-flow",
    metadata: { projects: 4, inProgress: 5, demo: true },
  },
];

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
    recentCount: 8,
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
      collectionTitle: "Release Activity",
      collectionUrl: "https://app.raindrop.io/my/3",
      raindropUrl: "https://app.raindrop.io/my/0/item/104",
      coverUrl: null,
    },
    {
      id: 105,
      title: "Community sponsorship benchmarks",
      excerpt: "Revenue and backer examples from open-source creator tools.",
      link: "https://opencollective.com/",
      domain: "opencollective.com",
      created: "2026-05-26T11:25:00Z",
      lastUpdate: "2026-05-26T11:25:00Z",
      tags: ["sponsorship", "community"],
      important: false,
      collectionId: 2,
      collectionTitle: "Growth",
      collectionUrl: "https://app.raindrop.io/my/2",
      raindropUrl: "https://app.raindrop.io/my/0/item/105",
      coverUrl: null,
    },
    {
      id: 106,
      title: "Search console query grouping",
      excerpt: "Organizing search terms by intent and opportunity.",
      link: "https://developers.google.com/search/docs/monitor-debug/search-analytics",
      domain: "developers.google.com",
      created: "2026-05-25T15:55:00Z",
      lastUpdate: "2026-05-25T15:55:00Z",
      tags: ["seo", "analytics"],
      important: false,
      collectionId: 1,
      collectionTitle: "Product Research",
      collectionUrl: "https://app.raindrop.io/my/1",
      raindropUrl: "https://app.raindrop.io/my/0/item/106",
      coverUrl: null,
    },
    {
      id: 107,
      title: "Incident response notes for small teams",
      excerpt: "Practical triage patterns for monitoring and customer updates.",
      link: "https://sentry.io/resources/",
      domain: "sentry.io",
      created: "2026-05-24T20:05:00Z",
      lastUpdate: "2026-05-24T20:05:00Z",
      tags: ["observability", "support"],
      important: true,
      collectionId: 3,
      collectionTitle: "Release Activity",
      collectionUrl: "https://app.raindrop.io/my/3",
      raindropUrl: "https://app.raindrop.io/my/0/item/107",
      coverUrl: null,
    },
    {
      id: 108,
      title: "Subscription retention checklist",
      excerpt: "Metrics and lifecycle moments to review before a pricing launch.",
      link: "https://www.revenuecat.com/blog/",
      domain: "revenuecat.com",
      created: "2026-05-23T10:40:00Z",
      lastUpdate: "2026-05-23T10:40:00Z",
      tags: ["revenue", "retention"],
      important: false,
      collectionId: 2,
      collectionTitle: "Growth",
      collectionUrl: "https://app.raindrop.io/my/2",
      raindropUrl: "https://app.raindrop.io/my/0/item/108",
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
      title: "Release Activity",
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
    {
      id: "roadmap-demo-3",
      name: "Creator sponsorship portal",
      state: "started",
      progress: 0.38,
      targetDate: "2026-07-16",
      health: "onTrack",
      issueCountDone: 7,
      issueCountInProgress: 3,
      issueCountOpen: 10,
      teams: ["Community"],
    },
    {
      id: "roadmap-demo-4",
      name: "Crash triage automation",
      state: "started",
      progress: 0.55,
      targetDate: "2026-07-25",
      health: "onTrack",
      issueCountDone: 11,
      issueCountInProgress: 4,
      issueCountOpen: 9,
      teams: ["Platform"],
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
    {
      id: "issue-demo-4",
      identifier: "COM-32",
      title: "Add sponsor tier comparison to public portal",
      url: "https://linear.app/radarboard/issue/COM-32",
      priority: "medium",
      assignee: { name: "Lena Ortiz", avatarUrl: null },
      projectName: "Creator sponsorship portal",
      projectColor: "#9b87f5",
      startedAt: "2026-05-27T10:45:00Z",
      timeInStarted: "4d",
      labels: [{ name: "sponsorship", color: "#9b87f5" }],
    },
    {
      id: "issue-demo-5",
      identifier: "PLT-207",
      title: "Group recurring crash signatures by release channel",
      url: "https://linear.app/radarboard/issue/PLT-207",
      priority: "high",
      assignee: { name: "Sam Rivera", avatarUrl: null },
      projectName: "Crash triage automation",
      projectColor: "#2a9d8f",
      startedAt: "2026-05-26T08:20:00Z",
      timeInStarted: "5d",
      labels: [{ name: "observability", color: "#2a9d8f" }],
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
    {
      login: "design-systems-lab",
      name: "Design Systems Lab",
      avatarUrl: "https://github.com/design-systems-lab.png",
      url: "https://github.com/design-systems-lab",
      type: "ORGANIZATION",
      tier: { name: "Team", monthlyPriceInCents: 12500 },
      since: "2026-03-18T00:00:00Z",
      isOneTime: false,
    },
    {
      login: "frontend-ops",
      name: "Frontend Ops",
      avatarUrl: "https://github.com/frontend-ops.png",
      url: "https://github.com/frontend-ops",
      type: "ORGANIZATION",
      tier: { name: "Creator", monthlyPriceInCents: 2500 },
      since: "2026-05-02T00:00:00Z",
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
    {
      id: "tier-demo-3",
      name: "Team",
      monthlyPriceInCents: 12500,
      description: "Shared roadmap notes and release previews.",
      isOneTime: false,
      sponsorCount: 8,
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
      { date: "2026-05-25", value: 28000 },
      { date: "2026-05-26", value: 36000 },
      { date: "2026-05-27", value: 42000 },
      { date: "2026-05-28", value: 39000 },
      { date: "2026-05-29", value: 46000 },
      { date: "2026-05-30", value: 51000 },
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
    {
      id: "oc-tx-demo-3",
      type: "CREDIT",
      amount: 25000,
      netAmount: 23900,
      currency: "USD",
      description: "Team sponsorship renewal",
      createdAt: "2026-05-26T15:10:00Z",
      fromAccount: { name: "Design Systems Lab", slug: "design-systems-lab", imageUrl: null },
      toAccount: { name: "Pixel Studio", slug: "pixel-studio" },
    },
    {
      id: "oc-tx-demo-4",
      type: "CREDIT",
      amount: 7500,
      netAmount: 7200,
      currency: "USD",
      description: "Creator tier contribution",
      createdAt: "2026-05-25T13:35:00Z",
      fromAccount: { name: "Frontend Ops", slug: "frontend-ops", imageUrl: null },
      toAccount: { name: "Pixel Studio", slug: "pixel-studio" },
    },
    {
      id: "oc-tx-demo-5",
      type: "DEBIT",
      amount: 18000,
      netAmount: 18000,
      currency: "USD",
      description: "Community design review",
      createdAt: "2026-05-23T18:45:00Z",
      fromAccount: { name: "Pixel Studio", slug: "pixel-studio", imageUrl: null },
      toAccount: { name: "Lena Ortiz", slug: "lena-ortiz" },
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
    {
      id: "oc-member-demo-3",
      role: "BACKER",
      tier: "Team",
      totalDonated: 96000,
      currency: "USD",
      since: "2026-02-18T00:00:00Z",
      account: {
        name: "Design Systems Lab",
        slug: "design-systems-lab",
        imageUrl: null,
        type: "ORGANIZATION",
      },
    },
    {
      id: "oc-member-demo-4",
      role: "BACKER",
      tier: "Creator",
      totalDonated: 38000,
      currency: "USD",
      since: "2026-04-22T00:00:00Z",
      account: {
        name: "Frontend Ops",
        slug: "frontend-ops",
        imageUrl: null,
        type: "ORGANIZATION",
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

const ALL_PROJECTS_SHOWCASE_OVERRIDES: Record<string, string> = {
  "cell-7": "sponsorship",
  "cell-9": "logs",
};

function seedDemoLogs(now: number): void {
  const existingDemoLogs = logBuffer.getEntries({ source: "demo/", limit: 1 });
  if (existingDemoLogs.total > 0) return;

  for (const [index, blueprint] of MOCK_LOG_BLUEPRINTS.entries()) {
    const entry: LogEntry = {
      id: `demo-log-${index + 1}`,
      timestamp: now * 1000 - (MOCK_LOG_BLUEPRINTS.length - index) * 180_000,
      level: blueprint.level,
      source: blueprint.source,
      message: blueprint.message,
      projectSlug: blueprint.projectSlug,
      metadata: blueprint.metadata,
    };
    logBuffer.push(entry);
  }
}

function canUseAllProjectsDemoWidget(widgetId: string): boolean {
  const descriptor = WIDGET_REGISTRY.get(widgetId);
  if (!descriptor) return false;
  return descriptor.supportedDashboardScopes?.includes("all-projects") ?? true;
}

function buildDemoWidgetAssignments(): Record<string, string | null> {
  initializeWidgetDescriptors();

  return normalizeDashboardWidgetLayout(
    BASIC_3X3,
    Object.fromEntries(
      Object.entries(DEMO_CONFIG.showcaseLayout).map(([cellId, slot]) => {
        const widgetId =
          [ALL_PROJECTS_SHOWCASE_OVERRIDES[cellId], slot.widgetId, slot.fallbackWidgetId].find(
            (candidate): candidate is string =>
              typeof candidate === "string" && canUseAllProjectsDemoWidget(candidate)
          ) ?? null;
        return [cellId, widgetId];
      })
    )
  );
}

function buildDemoWidgetMap(assignments: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(assignments).filter((entry): entry is [string, string] => entry[1] !== null)
  );
}

function applyDemoDashboardLayout(currentLayout: WidgetLayoutConfig | null): WidgetLayoutConfig {
  const assignments = buildDemoWidgetAssignments();

  return {
    ...currentLayout,
    configs: currentLayout?.configs ?? {},
    modalPrefs: currentLayout?.modalPrefs ?? {},
    layouts: [BASIC_3X3],
    projectLayouts: {
      ...(currentLayout?.projectLayouts ?? {}),
      [ALL_PROJECTS_SLUG]: {
        pages: [
          {
            name: "Overview",
            slug: DEFAULT_DASHBOARD_PAGE_SLUG,
            layoutId: BASIC_3X3.id,
            widgetLayouts: { [BASIC_3X3.id]: assignments },
          },
        ],
      },
    },
    preferences: {
      ...currentLayout?.preferences,
      demoMode: true,
      onboardingCompleted: true,
      blueprintWidgetMap: buildDemoWidgetMap(assignments),
    },
    appearance: currentLayout?.appearance,
  };
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
      errorTrend: [
        { date: "2026-05-18", value: 6 },
        { date: "2026-05-19", value: 4 },
        { date: "2026-05-20", value: 7 },
        { date: "2026-05-21", value: 5 },
        { date: "2026-05-22", value: 3 },
        { date: "2026-05-23", value: 4 },
        { date: "2026-05-24", value: 2 },
        { date: "2026-05-25", value: 5 },
        { date: "2026-05-26", value: 3 },
        { date: "2026-05-27", value: 4 },
        { date: "2026-05-28", value: 2 },
        { date: "2026-05-29", value: 3 },
        { date: "2026-05-30", value: 1 },
      ],
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
    seedDemoLogs(now);

    const currentLayout = await settings.getWidgetLayout();
    await settings.setWidgetLayout(applyDemoDashboardLayout(currentLayout));

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
