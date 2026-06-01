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
  integrations: ["shipping"] as const,

  /** Plugins enabled in demo mode. */
  plugins: ["tasks", "notes", "bookmarks"] as const,

  /** Widgets that have demo data available. */
  widgets: [
    "revenue",
    "analytics",
    "seo",
    "npm-downloads",
    "app-reviews",
    "bookmarks",
    "shipping",
    "github-stars",
    "vercel-domains",
    "observability",
    "roadmap",
    "sponsorship",
  ] as const,

  /**
   * Preferred demo dashboard. Provider/community widgets are used when
   * registered; each slot has a core fallback so core-only demo mode still
   * renders without unknown-widget placeholders.
   */
  showcaseLayout: {
    "cell-1": { widgetId: "seo", fallbackWidgetId: "seo" },
    "cell-2": { widgetId: "analytics", fallbackWidgetId: "analytics" },
    "cell-3": { widgetId: "npm-downloads", fallbackWidgetId: "revenue" },
    "cell-4": { widgetId: "app-reviews", fallbackWidgetId: "observability" },
    "cell-5": { widgetId: "bookmarks", fallbackWidgetId: "bookmarks" },
    "cell-6": { widgetId: "shipping", fallbackWidgetId: "shipping" },
    "cell-7": { widgetId: "github-stars", fallbackWidgetId: "sponsorship" },
    "cell-8": { widgetId: "vercel-domains", fallbackWidgetId: "roadmap" },
    "cell-9": { widgetId: "observability", fallbackWidgetId: "observability" },
  } as const,

  /** Blueprint applied when entering demo mode. */
  blueprintId: "indie-revenue-dashboard",

  /** Default profile for demo users. */
  profile: "indie" as const,
} as const;

export type DemoIntegration = (typeof DEMO_CONFIG.integrations)[number];
export type DemoPlugin = (typeof DEMO_CONFIG.plugins)[number];
export type DemoWidget = (typeof DEMO_CONFIG.widgets)[number];
