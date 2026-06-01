/**
 * Marketing site integration data.
 *
 * The integration list is derived from the canonical INTEGRATION_REGISTRY
 * in @radarboard/integrations. Marketing-specific fields (domain, url, category
 * labels) are enriched here since they are presentation concerns.
 *
 * To add a new integration to the marketing site:
 *   1. Create it in packages/integrations/ (pnpm create-integration <name>)
 *   2. Add a marketing entry to MARKETING_DATA below
 *   3. It will appear automatically on the integrations page
 */

export type IntegrationCategory =
  | "revenue"
  | "analytics"
  | "seo"
  | "monitoring"
  | "shipping"
  | "sponsorship"
  | "app-store"
  | "distribution"
  | "alerts";

export interface Integration {
  slug: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  domain: string;
  url: string;
  authModes: string[];
  bestFor: string[];
  signals: string[];
}

export const categoryLabels: Record<IntegrationCategory, string> = {
  revenue: "Revenue",
  analytics: "Analytics",
  seo: "SEO",
  monitoring: "Monitoring",
  shipping: "Release Activity",
  sponsorship: "Sponsorship",
  "app-store": "App Store",
  distribution: "Distribution",
  alerts: "Alerts",
};

export const categoryColorClasses: Record<IntegrationCategory, string> = {
  revenue: "bg-success",
  analytics: "bg-accent",
  seo: "bg-accent-light",
  monitoring: "bg-destructive",
  shipping: "bg-muted",
  sponsorship: "bg-warning",
  "app-store": "bg-accent",
  distribution: "bg-success",
  alerts: "bg-destructive",
};

/**
 * Marketing data keyed by integration slug (must match the `id` field
 * in the corresponding IntegrationDescriptor in packages/integrations/).
 *
 * When a new integration is added to the registry, add an entry here
 * to control how it appears on the marketing site.
 */
const MARKETING_DATA: Record<string, Omit<Integration, "slug">> = {
  revenuecat: {
    name: "RevenueCat",
    description: "Subscription revenue, MRR, and customer analytics",
    category: "revenue",
    domain: "revenuecat.com",
    url: "https://revenuecat.com",
    authModes: ["API"],
    bestFor: ["SaaS", "Mobile apps"],
    signals: ["MRR", "Churn", "Subscribers"],
  },
  openpanel: {
    name: "OpenPanel",
    description: "Web analytics with visitors, top pages, referrers, and traffic trends",
    category: "analytics",
    domain: "openpanel.dev",
    url: "https://openpanel.dev",
    authModes: ["API"],
    bestFor: ["Creators", "Teams"],
    signals: ["Visitors", "Referrers", "Conversions"],
  },
  "google-search-console": {
    name: "Google Search Console",
    description: "SEO performance with search queries, clicks, impressions, and rankings",
    category: "seo",
    domain: "search.google.com",
    url: "https://search.google.com/search-console",
    authModes: ["OAuth"],
    bestFor: ["SEO", "Content"],
    signals: ["Queries", "Clicks", "Rankings"],
  },
  sentry: {
    name: "Sentry",
    description: "Error tracking with unresolved issues and project health stats",
    category: "monitoring",
    domain: "sentry.io",
    url: "https://sentry.io",
    authModes: ["API"],
    bestFor: ["Apps", "APIs"],
    signals: ["Errors", "Issues", "Latency"],
  },
  betterstack: {
    name: "BetterStack",
    description: "Uptime monitoring with health checks and incident tracking",
    category: "monitoring",
    domain: "betterstack.com",
    url: "https://betterstack.com",
    authModes: ["API"],
    bestFor: ["Ops", "Status"],
    signals: ["Uptime", "Incidents", "Checks"],
  },
  vercel: {
    name: "Vercel",
    description: "Deployment tracking with release activity and deploy history",
    category: "shipping",
    domain: "vercel.com",
    url: "https://vercel.com",
    authModes: ["API"],
    bestFor: ["Web apps", "Teams"],
    signals: ["Deploys", "Projects", "Builds"],
  },
  linear: {
    name: "Linear",
    description: "Issue tracking for ideas, bugs, and released features",
    category: "shipping",
    domain: "linear.app",
    url: "https://linear.app",
    authModes: ["API"],
    bestFor: ["Teams", "Roadmaps"],
    signals: ["Issues", "Cycles", "Projects"],
  },
  github: {
    name: "GitHub",
    description: "Repository activity, pull requests, issues, stars, and forks",
    category: "shipping",
    domain: "github.com",
    url: "https://github.com",
    authModes: ["OAuth", "API"],
    bestFor: ["Maintainers", "Developers"],
    signals: ["PRs", "Releases", "Stars"],
  },
  "open-collective": {
    name: "Open Collective",
    description: "Sponsorship metrics, backers, transactions, and balance",
    category: "sponsorship",
    domain: "opencollective.com",
    url: "https://opencollective.com",
    authModes: ["API"],
    bestFor: ["Communities", "Maintainers"],
    signals: ["Backers", "Balance", "Transactions"],
  },
  "github-sponsors": {
    name: "GitHub Sponsors",
    description: "Sponsor tiers, active sponsors, and sponsorship stats",
    category: "sponsorship",
    domain: "github.com",
    url: "https://github.com/sponsors",
    authModes: ["API"],
    bestFor: ["Maintainers", "Creators"],
    signals: ["Sponsors", "Tiers", "Recurring support"],
  },
  "app-store-connect": {
    name: "App Store Connect",
    description: "App Store reviews, average rating, and version info",
    category: "app-store",
    domain: "developer.apple.com",
    url: "https://appstoreconnect.apple.com",
    authModes: ["API"],
    bestFor: ["Mobile apps", "Indies"],
    signals: ["Ratings", "Reviews", "Versions"],
  },
  npm: {
    name: "npm",
    description: "Package download stats with weekly and monthly trends",
    category: "distribution",
    domain: "npmjs.com",
    url: "https://npmjs.com",
    authModes: ["API"],
    bestFor: ["Packages", "Maintainers"],
    signals: ["Downloads", "Release impact", "Package reach"],
  },
  resend: {
    name: "Resend",
    description: "Email alerts for health failures and revenue anomalies",
    category: "alerts",
    domain: "resend.com",
    url: "https://resend.com",
    authModes: ["API"],
    bestFor: ["Alerts", "Operations"],
    signals: ["Notifications", "Delivery", "Escalation"],
  },
};

/** All integrations with marketing data, keyed by slug. */
export const integrations: Integration[] = Object.entries(MARKETING_DATA).map(([slug, data]) => ({
  slug,
  ...data,
}));

export function getIntegrationsByCategory() {
  const grouped = new Map<IntegrationCategory, Integration[]>();
  for (const integration of integrations) {
    const list = grouped.get(integration.category) ?? [];
    list.push(integration);
    grouped.set(integration.category, list);
  }
  return grouped;
}

export function getFaviconUrl(domain: string, size = 32) {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
