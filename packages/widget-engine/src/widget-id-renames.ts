/**
 * Cumulative map of every historical widget ID rename.
 *
 * When you rename a widget, add the OLD id as key → NEW id as value.
 * The client-side migration walks stored layouts/configs and replaces
 * any key it finds in this map with the current value.
 *
 * Because the map is cumulative, a user who hasn't opened the app since
 * the *first* rename will still migrate correctly in a single pass.
 */
export const WIDGET_ID_RENAMES: Record<string, string> = {
  "vercel-deployments": "deployments",
  "vercel-build-perf": "builds",
  "vercel-projects": "projects",
  domains: "vercel-domains",
  downloads: "npm-downloads",
  "github-activity": "pulls",
  stars: "github-stars",
  commits: "github-commits",
  raindrop: "bookmarks",
  "review-pulse": "app-reviews",
  detail: "observability",
  ideas: "roadmap",
};
