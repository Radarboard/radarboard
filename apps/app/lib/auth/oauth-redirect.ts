/**
 * Normalizes an origin URL so it can be used as an OAuth redirect URI.
 *
 * Some OAuth providers reject custom `.localhost` subdomains for local
 * development even when plain `localhost` is accepted. This keeps the current
 * scheme/port and strips only the subdomain so the redirect URI matches what
 * is registered with the provider.
 *
 * Examples:
 *   http://radarboard.localhost:1355  →  http://localhost:1355
 *   https://radarboard.localhost:1355 →  https://localhost:1355
 *   http://radarboard.localhost       →  http://localhost
 *   https://myapp.com             →  https://myapp.com  (unchanged)
 */
export function normalizeOAuthOrigin(origin: string): string {
  const url = new URL(origin);
  const { hostname } = url;

  // Match any *.localhost hostname and replace with plain localhost
  if (hostname !== "localhost" && hostname.endsWith(".localhost")) {
    url.hostname = "localhost";
  }

  // Remove default ports to keep the URI clean
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  return url.origin;
}
