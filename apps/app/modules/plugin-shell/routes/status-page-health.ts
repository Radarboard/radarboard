import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { errorJson } from "@/lib/api";

export const handleGetStatusPageHealth = withLogging(API_ROUTES.statusPageProjectHealth, async () =>
  errorJson(404, "Status page plugin is not installed")
);
