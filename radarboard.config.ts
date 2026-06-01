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
   * Core provider integrations.
   *
   * Keep this empty unless Radarboard itself must ship a connectable provider
   * by default. Concrete SaaS/provider integrations such as GitHub, Stripe,
   * Vercel, Sentry, Slack, and Linear live in the community extension catalog.
   */
  integrations: [],

  /**
   * Core virtual integrations.
   *
   * These packages expose provider-neutral data sources without a connectable
   * IntegrationDescriptor, so they do not appear in the integrations list.
   */
  virtualIntegrations: ["@radarboard/integration-shipping"],

  /**
   * Plugins extend the dashboard with overlays, tools, and data connections.
   * Each entry is an npm package name under /plugins/.
   */
  plugins: [
    "@radarboard/plugin-tasks",
    "@radarboard/plugin-notes",
    "@radarboard/plugin-bookmarks",
    "@radarboard/plugin-embeddings",
    "@radarboard/plugin-backup",
  ],

  /**
   * Widgets render data on the dashboard grid.
   * Each entry is an npm package name under /widgets/.
   */
  widgets: [
    "@radarboard/widget-analytics",
    "@radarboard/widget-logs",
    "@radarboard/widget-observability",
    "@radarboard/widget-bookmarks",
    "@radarboard/widget-revenue",
    "@radarboard/widget-roadmap",
    "@radarboard/widget-seo",
    "@radarboard/widget-shipping",
    "@radarboard/widget-sponsorship",
  ],
};
