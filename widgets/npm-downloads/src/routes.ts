import { integrationRoute } from "@radarboard/types/api-routes";

/** Widget-specific API routes for the Downloads widget. */
export const ROUTES = {
  npmDownloads: integrationRoute("npm", "data"),
} as const;
