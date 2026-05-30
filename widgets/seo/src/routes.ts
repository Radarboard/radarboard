import { integrationRoute } from "@radarboard/types/api-routes";

/** Widget-specific API routes for the SEO widget. */
export const ROUTES = {
  seoQuery: integrationRoute("google-search-console", "query"),
} as const;
