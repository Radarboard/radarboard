/**
 * Demo mode configuration — single source of truth for what the demo includes.
 *
 * When adding a new integration, widget, or plugin to the demo:
 * 1. Add it to the appropriate array below
 * 2. Create or extend mock data in ./data/
 * 3. The widget hook's `useDemoMode()` check handles the rest
 */

export const DEMO_CONFIG = {
  /** Integrations shown as "connected" in demo mode. */
  integrations: ["github", "vercel", "stripe", "openpanel", "sentry"] as const,

  /** Plugins enabled in demo mode. */
  plugins: ["tasks", "notes", "bookmarks", "rss-reader", "changelog", "status-page"] as const,

  /** Widgets that have demo data available. */
  widgets: [
    "revenue",
    "shipping",
    "roadmap",
    "analytics",
    "seo",
    "github-stars",
    "pulls",
    "github-commits",
    "deployments",
    "vercel-domains",
    "observability",
    "npm-downloads",
  ] as const,

  /** Blueprint applied when entering demo mode. */
  blueprintId: "indie-revenue-dashboard",

  /** Default profile for demo users. */
  profile: "indie" as const,
} as const;

export type DemoIntegration = (typeof DEMO_CONFIG.integrations)[number];
export type DemoPlugin = (typeof DEMO_CONFIG.plugins)[number];
export type DemoWidget = (typeof DEMO_CONFIG.widgets)[number];
