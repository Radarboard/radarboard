/**
 * Register polling source definitions.
 *
 * This is an app-level concern — the polling intervals and widget groupings
 * are configured here rather than in `packages/types` to keep shared types
 * free of integration-specific knowledge.
 *
 * Import this as a side effect after integrations-init.ts:
 *   import "@/lib/polling-config";
 */

import {
  type PollingDataSourceRef,
  type PollingSourceDefinition,
  registerPollingSource,
} from "@radarboard/types/polling";

function definePollingSource(
  id: string,
  definition: Omit<PollingSourceDefinition, "category" | "dataSources" | "widgetIds"> & {
    category: PollingSourceDefinition["category"];
    dataSources?: PollingDataSourceRef[];
    widgetIds?: string[];
  }
) {
  registerPollingSource(id, {
    ...definition,
    widgetIds: definition.widgetIds ?? [],
    dataSources: definition.dataSources ?? [],
  });
}

definePollingSource("analytics", {
  label: "Analytics",
  description: "Refreshes analytics widgets backed by OpenPanel data.",
  category: "widget",
  defaultIntervalMs: 60_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["analytics"],
  dataSources: [{ integration: "openpanel", action: "data" }],
});

definePollingSource("app-store", {
  label: "App Store",
  description: "Refreshes App Store review and observability widgets.",
  category: "widget",
  defaultIntervalMs: 900_000,
  allowedIntervalsMs: [300_000, 600_000, 900_000, 1_800_000],
  widgetIds: ["app-reviews", "observability"],
  dataSources: [{ integration: "app-store-connect", action: "data" }],
});

definePollingSource("aso-keywords", {
  label: "ASO Keywords",
  description: "Refreshes keyword ranking data from Astro.",
  category: "widget",
  defaultIntervalMs: 900_000,
  allowedIntervalsMs: [300_000, 600_000, 900_000, 1_800_000],
  widgetIds: ["aso-keywords"],
  dataSources: [{ integration: "astro", action: "keywords" }],
});

definePollingSource("github-activity", {
  label: "GitHub Activity",
  description: "Refreshes pull request, issue, and commit activity widgets.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["github-commits", "pulls"],
  dataSources: [
    { integration: "github", action: "open-prs" },
    { integration: "github", action: "open-issues" },
    { integration: "github", action: "commits" },
  ],
});

definePollingSource("github-stars", {
  label: "GitHub Stars",
  description: "Refreshes GitHub star counts and history widgets.",
  category: "widget",
  defaultIntervalMs: 600_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000, 3_600_000],
  widgetIds: ["github-stars"],
  dataSources: [{ integration: "github", action: "stars" }],
});

definePollingSource("health", {
  label: "Health Monitors",
  description: "Refreshes Better Stack health checks in observability surfaces.",
  category: "widget",
  defaultIntervalMs: 60_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 120_000, 300_000],
  widgetIds: ["observability"],
  dataSources: [{ integration: "betterstack", action: "data" }],
});

definePollingSource("logs", {
  label: "Logs",
  description: "Refreshes structured application log streams when live mode is off.",
  category: "widget",
  defaultIntervalMs: 5_000,
  allowedIntervalsMs: [5_000, 15_000, 30_000, 60_000],
  widgetIds: ["logs"],
});

definePollingSource("notifications-badge", {
  label: "Notification Badge",
  description: "Refreshes unread notification counts when streaming is unavailable.",
  category: "app",
  defaultIntervalMs: 10_000,
  allowedIntervalsMs: [5_000, 10_000, 30_000, 60_000],
});

definePollingSource("notifications-feed", {
  label: "Notification Feed",
  description: "Refreshes notification center content when live updates are disabled.",
  category: "app",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [10_000, 30_000, 60_000, 300_000],
});

definePollingSource("npm-downloads", {
  label: "npm Downloads",
  description: "Refreshes npm package download widgets.",
  category: "widget",
  defaultIntervalMs: 3_600_000,
  allowedIntervalsMs: [600_000, 1_800_000, 3_600_000],
  widgetIds: ["npm-downloads"],
  dataSources: [{ integration: "npm", action: "data" }],
});

definePollingSource("plugin-bookmarks", {
  label: "Bookmarks Plugin",
  description: "Refreshes the bookmarks plugin widget surfaces.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["bookmarks__quick-access"],
});

definePollingSource("plugin-changelog", {
  label: "Changelog Plugin",
  description: "Refreshes changelog plugin widgets and unread changelog metadata.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["changelog__timeline"],
});

definePollingSource("plugin-dock-status-page", {
  label: "Plugin Dock Status",
  description: "Refreshes the dock health indicator from the status page plugin cache.",
  category: "app",
  defaultIntervalMs: 60_000,
  allowedIntervalsMs: [15_000, 60_000, 300_000, 600_000],
});

definePollingSource("plugin-expenses", {
  label: "Expenses Plugin",
  description: "Refreshes expense tracking plugin widgets.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["expenses__overview"],
});

definePollingSource("plugin-notes", {
  label: "Notes Plugin",
  description: "Refreshes recent note summaries in plugin widgets.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["notes__recent"],
});

definePollingSource("plugin-rss-reader", {
  label: "RSS Reader Plugin",
  description: "Refreshes RSS feeds and unread article widget views.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["rss-reader__feed"],
});

definePollingSource("plugin-status-page", {
  label: "Status Page Plugin",
  description: "Refreshes status page plugin widgets from the cached status snapshot.",
  category: "plugin",
  defaultIntervalMs: 15_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["status-page__summary"],
});

definePollingSource("plugin-tasks", {
  label: "Tasks Plugin",
  description: "Refreshes task summaries and the current Pomodoro session.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["tasks__today"],
});

definePollingSource("plugin-webhook-relay", {
  label: "Webhook Relay Plugin",
  description: "Refreshes webhook relay dashboard summaries.",
  category: "plugin",
  defaultIntervalMs: 15_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["webhook-relay__activity"],
});

definePollingSource("raindrop", {
  label: "Raindrop",
  description: "Refreshes bookmark widgets backed by Raindrop data.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["bookmarks"],
  dataSources: [{ integration: "raindrop", action: "data" }],
});

definePollingSource("revenue", {
  label: "Revenue",
  description: "Refreshes revenue widgets backed by Stripe and RevenueCat.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["revenue"],
  dataSources: [
    { integration: "revenuecat", action: "data" },
    { integration: "stripe", action: "data" },
  ],
});

definePollingSource("roadmap", {
  label: "Roadmap",
  description: "Refreshes roadmap widgets backed by Linear.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["roadmap"],
  dataSources: [{ integration: "linear", action: "roadmap" }],
});

definePollingSource("sentry", {
  label: "Sentry",
  description: "Refreshes Sentry issue and observability widgets.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["observability"],
  dataSources: [{ integration: "sentry", action: "data" }],
});

definePollingSource("sentry-projects", {
  label: "Sentry Projects",
  description: "Refreshes the Sentry project list in project settings.",
  category: "app",
  defaultIntervalMs: 600_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 1_800_000],
  dataSources: [{ integration: "sentry", action: "projects" }],
});

definePollingSource("seo", {
  label: "SEO",
  description: "Refreshes Search Console widgets and reports.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["seo"],
  dataSources: [{ integration: "google-search-console", action: "data" }],
});

definePollingSource("shipping", {
  label: "Shipping",
  description: "Refreshes shipping and release readiness widgets.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["shipping"],
  dataSources: [{ integration: "shipping", action: "data" }],
});

definePollingSource("sponsorship", {
  label: "Sponsorship",
  description: "Refreshes sponsorship widgets backed by Open Collective and GitHub Sponsors.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["sponsorship"],
  dataSources: [
    { integration: "open-collective", action: "data" },
    { integration: "github-sponsors", action: "data" },
  ],
});

definePollingSource("vercel-deployments", {
  label: "Vercel Deployments",
  description: "Refreshes Vercel deployment, build, and project widgets.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["builds", "deployments", "projects"],
  dataSources: [{ integration: "vercel", action: "deployments" }],
});

definePollingSource("vercel-domains", {
  label: "Vercel Domains",
  description: "Refreshes domain status widgets backed by Vercel.",
  category: "widget",
  defaultIntervalMs: 600_000,
  allowedIntervalsMs: [300_000, 600_000, 900_000, 1_800_000],
  widgetIds: ["vercel-domains"],
  dataSources: [{ integration: "vercel", action: "domains" }],
});
