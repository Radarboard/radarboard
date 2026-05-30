import { integrationRoute } from "@radarboard/types/api-routes";
import { mutate } from "swr";
import { apiFetcher, buildUrl } from "./fetcher";

/**
 * Widget API routes that appear on most dashboards.
 * Prefetching these on tab hover gives near-instant project switching.
 */
const CORE_WIDGET_ROUTES = [
  "/api/analytics/data",
  integrationRoute("github", "open-prs"),
  integrationRoute("github", "open-issues"),
  integrationRoute("vercel", "deployments"),
  integrationRoute("github", "commit-activity"),
  integrationRoute("google-search-console", "data"),
  integrationRoute("sentry", "data"),
  integrationRoute("revenuecat", "data"),
];

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Pre-warm the SWR cache for core widget data when the user hovers a
 * project tab. Each route is fetched with the target project slug and
 * written into the SWR cache via `mutate`. When the widget later mounts
 * with the same key, SWR returns the cached data without a loading state.
 *
 * Debounced to 100 ms to avoid firing on casual mouse movement.
 */
export function prefetchProjectData(
  projectSlug: string | null,
  timeRange: string,
  timezone: string
): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    for (const route of CORE_WIDGET_ROUTES) {
      const key = buildUrl(route, {
        range: timeRange,
        project: projectSlug,
        timezone,
      });

      // Populate cache silently — failures are ignored since the widget
      // hook will retry on mount anyway.
      mutate(key, apiFetcher(key), { revalidate: false }).catch(() => {
        // Silently ignore — the widget hook will retry on mount.
      });
    }
  }, 100);
}
