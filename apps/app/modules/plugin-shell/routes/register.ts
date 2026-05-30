/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTE_PATTERNS, API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handlePluginActionGet, handlePluginActionPost } from "./action";
import { handleDeletePluginData, handleGetPluginData, handlePutPluginData } from "./data";
import { handleListPluginData } from "./data-list";
import { handleGetStatusPageHealth } from "./status-page-health";
import { handleIssuePluginToken } from "./token";
import { handleWebhookRelayPoll } from "./webhook-relay-poll";

type PluginRouteContext = {
  params: Promise<{ plugin: string; action: string }>;
};

registerRoutes([
  {
    path: API_ROUTE_PATTERNS.pluginAction,
    handlers: {
      GET: async (request: Request, context?: unknown) =>
        handlePluginActionGet(request, context as PluginRouteContext),
      POST: async (request: Request, context?: unknown) =>
        handlePluginActionPost(request, context as PluginRouteContext),
    },
  },
  {
    path: API_ROUTES.pluginData,
    handlers: {
      GET: handleGetPluginData,
      PUT: handlePutPluginData,
      DELETE: handleDeletePluginData,
    },
  },
  {
    path: API_ROUTES.pluginDataList,
    handlers: { GET: handleListPluginData },
  },
  {
    path: API_ROUTES.pluginToken,
    handlers: { POST: handleIssuePluginToken },
  },
  {
    path: API_ROUTES.statusPageProjectHealth,
    handlers: { GET: handleGetStatusPageHealth },
  },
  {
    path: API_ROUTES.relayPoll,
    handlers: { POST: handleWebhookRelayPoll },
  },
]);
