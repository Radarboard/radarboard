import { integrationRoute } from "@radarboard/types/api-routes";

/** Widget-specific API routes for the __WIDGET_NAME__ widget. */
export const ROUTES = {
  __WIDGET_CAMEL__: integrationRoute("__WIDGET_KEBAB__", "data"),
} as const;
