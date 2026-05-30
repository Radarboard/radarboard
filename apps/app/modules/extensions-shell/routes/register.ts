/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleGetDependencyGraph } from "./dependency-graph";
import { handleGetExtensionHealthScore } from "./health-score";
import { handleInstallExtension } from "./install";
import { handleGetExtensionRecommendations } from "./recommendations";
import { handleGetExtensionUpdates } from "./updates";
import { handleGetExtensionUsage, handleTrackExtensionUsage } from "./usage";
import { handleValidateExtension } from "./validate";

registerRoutes([
  {
    path: API_ROUTES.extensionsInstall,
    handlers: { POST: handleInstallExtension },
  },
  {
    path: API_ROUTES.extensionsUsage,
    handlers: { GET: handleGetExtensionUsage, POST: handleTrackExtensionUsage },
  },
  {
    path: API_ROUTES.extensionsHealthScore,
    handlers: { GET: handleGetExtensionHealthScore },
  },
  {
    path: API_ROUTES.extensionsUpdates,
    handlers: { GET: handleGetExtensionUpdates },
  },
  {
    path: API_ROUTES.extensionsValidate,
    handlers: { POST: handleValidateExtension },
  },
  {
    path: API_ROUTES.extensionsRecommendations,
    handlers: { GET: handleGetExtensionRecommendations },
  },
  {
    path: API_ROUTES.extensionsDependencyGraph,
    handlers: { GET: handleGetDependencyGraph },
  },
]);
