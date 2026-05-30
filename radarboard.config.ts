/**
 * Radarboard — Extension Configuration
 *
 * Declare which integrations, plugins, widgets, and features are active.
 * Run `pnpm generate:extensions` after editing to regenerate init files.
 *
 * Adding an extension:    add its package name below + `pnpm generate:extensions`
 * Removing an extension:  remove it from below + `pnpm generate:extensions`
 */

export default {
  /**
   * Developer extensions — load from local filesystem paths during development.
   * Each entry maps an extension category to an absolute or relative path.
   * These are only loaded in development mode (NODE_ENV !== "production").
   *
   * Example:
   *   devExtensions: [
   *     { type: "integration", path: "../my-notion-ext/integrations/notion" },
   *     { type: "plugin", path: "../my-notion-ext/plugins/notion" },
   *     { type: "widget", path: "/Users/me/projects/my-widget" },
   *   ],
   */
  devExtensions: [] as Array<{ type: "integration" | "plugin" | "widget"; path: string }>,

  /**
   * Features are composable, toggleable capabilities.
   * Each entry is a package name under /features/.
   * System-tier features (onboarding, demoMode) are defined inline in features.ts.
   */
  features: [
    "@radarboard/feature-assistant",
    "@radarboard/feature-briefing",
    "@radarboard/feature-mcp-servers",
    "@radarboard/feature-memory",
    "@radarboard/feature-notifications",
    "@radarboard/feature-onboarding",
    "@radarboard/feature-skills",
    "@radarboard/feature-workflows",
  ],

  /**
   * Integrations connect to external services (GitHub, Vercel, Sentry, etc.).
   * Each entry is an npm package name under /integrations/.
   */
  integrations: [
    "@radarboard/integration-app-store-connect",
    "@radarboard/integration-betterstack",
    "@radarboard/integration-github",
    "@radarboard/integration-github-sponsors",
    "@radarboard/integration-google-search-console",
    "@radarboard/integration-linear",
    "@radarboard/integration-npm",
    "@radarboard/integration-open-collective",
    "@radarboard/integration-openpanel",
    "@radarboard/integration-raindrop",
    "@radarboard/integration-resend",
    "@radarboard/integration-revenuecat",
    "@radarboard/integration-sentry",
    "@radarboard/integration-slack",
    "@radarboard/integration-stripe",
    "@radarboard/integration-vercel",
  ],

  /**
   * Virtual integrations — composite data sources that aggregate
   * from multiple integrations. No descriptor, only data sources.
   */
  virtualIntegrations: [
    "@radarboard/integration-shipping",
    "@radarboard/integration-astro",
  ],

  /**
   * Plugins extend the dashboard with overlays, tools, and data connections.
   * Each entry is an npm package name under /plugins/.
   */
  plugins: [
    "@radarboard/plugin-tasks",
    "@radarboard/plugin-expenses",
    "@radarboard/plugin-notes",
    "@radarboard/plugin-bookmarks",
    "@radarboard/plugin-rss-reader",
    "@radarboard/plugin-changelog",
    "@radarboard/plugin-status-page",
    "@radarboard/plugin-webhook-relay",
    "@radarboard/plugin-embeddings",
    "@radarboard/plugin-backup",
  ],

  /**
   * Widgets render data on the dashboard grid.
   * Each entry is an npm package name under /widgets/.
   */
  widgets: [
    "@radarboard/widget-analytics",
    "@radarboard/widget-aso-keywords",
    "@radarboard/widget-builds",
    "@radarboard/widget-github-commits",
    "@radarboard/widget-deployments",
    "@radarboard/widget-vercel-domains",
    "@radarboard/widget-npm-downloads",
    "@radarboard/widget-logs",
    "@radarboard/widget-observability",
    "@radarboard/widget-projects",
    "@radarboard/widget-pulls",
    "@radarboard/widget-bookmarks",
    "@radarboard/widget-revenue",
    "@radarboard/widget-app-reviews",
    "@radarboard/widget-roadmap",
    "@radarboard/widget-seo",
    "@radarboard/widget-shipping",
    "@radarboard/widget-sponsorship",
    "@radarboard/widget-github-stars",
  ],
};
