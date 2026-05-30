import { integrationRoute } from "@radarboard/types/api-routes";

/** Widget-specific API routes for the Stars widget. */
export const ROUTES = {
  githubStars: integrationRoute("github", "stars"),
  githubStarsHistory: integrationRoute("github", "stars-history"),
} as const;
