const SERVICE_DOMAINS: Record<string, string> = {
  revenuecat: "revenuecat.com",
  opencollective: "opencollective.com",
  vercel: "vercel.com",
  linear: "linear.app",
  github: "github.com",
  openpanel: "openpanel.dev",
  "google-search-console": "search.google.com",
  sentry: "sentry.io",
  "app-store-connect": "developer.apple.com",
  betterstack: "betterstack.com",
  npm: "npmjs.com",
};

export function getServiceFaviconUrl(credKey: string, size = 16): string {
  const domain = SERVICE_DOMAINS[credKey];
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
