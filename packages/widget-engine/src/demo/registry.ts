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

  /** Widgets that have demo data available (must be registered widgets). */
  widgets: [
    "revenue",
    "analytics",
    "seo",
    "bookmarks",
    "shipping",
    "observability",
    "roadmap",
    "sponsorship",
    "logs",
  ] as const,

  /**
   * Preferred demo dashboard. Every slot references a registered widget so the
   * demo renders without unknown-widget placeholders. `fallbackWidgetId` is kept
   * for forward-compat if a provider/community widget later takes a slot.
   */
  showcaseLayout: {
    "cell-1": { widgetId: "seo", fallbackWidgetId: "seo" },
    "cell-2": { widgetId: "analytics", fallbackWidgetId: "analytics" },
    "cell-3": { widgetId: "revenue", fallbackWidgetId: "revenue" },
    "cell-4": { widgetId: "observability", fallbackWidgetId: "observability" },
    "cell-5": { widgetId: "bookmarks", fallbackWidgetId: "bookmarks" },
    "cell-6": { widgetId: "shipping", fallbackWidgetId: "shipping" },
    "cell-7": { widgetId: "sponsorship", fallbackWidgetId: "sponsorship" },
    "cell-8": { widgetId: "roadmap", fallbackWidgetId: "roadmap" },
    "cell-9": { widgetId: "logs", fallbackWidgetId: "logs" },
  } as const,

  /** Blueprint applied when entering demo mode. */
  blueprintId: "indie-revenue-dashboard",

  /** Default profile for demo users. */
  profile: "indie" as const,
} as const;

export type DemoIntegration = (typeof DEMO_CONFIG.integrations)[number];
export type DemoPlugin = (typeof DEMO_CONFIG.plugins)[number];
export type DemoWidget = (typeof DEMO_CONFIG.widgets)[number];
