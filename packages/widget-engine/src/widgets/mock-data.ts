// Backward-compatible barrel — widget hooks import from here.
// New code should import from @radarboard/widget-engine/demo instead.

export { MOCK_ANALYTICS } from "../demo/data/analytics";
export type { MockChangelogEntry } from "../demo/data/changelogs";
export { MOCK_CHANGELOGS } from "../demo/data/changelogs";
export {
  MOCK_VERCEL_DEPLOYMENTS,
  MOCK_VERCEL_DOMAINS,
  MOCK_VERCEL_PROJECTS,
} from "../demo/data/deployments";
export type { MockCommitsData, MockGitHubStarsData } from "../demo/data/github";
export {
  MOCK_GITHUB_COMMITS,
  MOCK_GITHUB_ISSUES,
  MOCK_GITHUB_PULLS,
  MOCK_GITHUB_STARS,
} from "../demo/data/github";
export { MOCK_HEALTH_CHECKS } from "../demo/data/health";
export { generateSparkline } from "../demo/data/helpers";
export { MOCK_REVENUE, MOCK_REVENUE_SERIES } from "../demo/data/revenue";
export { MOCK_ROADMAP_IN_PROGRESS, MOCK_ROADMAP_PROJECTS } from "../demo/data/roadmap";
export { MOCK_SEO } from "../demo/data/seo";
export { MOCK_SHIPPING } from "../demo/data/shipping";
