import { integrationRoute } from "@radarboard/types/api-routes";

/** Widget-specific API routes for the Domains widget. */
export const ROUTES = {
  vercelDomains: integrationRoute("vercel", "domains"),
} as const;
