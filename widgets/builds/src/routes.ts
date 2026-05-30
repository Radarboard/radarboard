import { integrationRoute } from "@radarboard/types/api-routes";

/** Widget-specific API routes for the Builds widget. */
export const ROUTES = {
  vercelDeployments: integrationRoute("vercel", "deployments"),
} as const;
