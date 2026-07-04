/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTE_PATTERNS, API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleAnalyticsAction, handleIntegrationActionPost, handleIntegrationData } from "./data";
import { handleLemonSqueezyWebhook } from "./lemonsqueezy-webhook";
import { handleListUserIntegrations, handleRemoveUserIntegration } from "./user-integrations";
import { handleIntegrationWebhook } from "./webhook";

type IntegrationRouteContext = {
  params: Promise<{ integration: string; action: string }>;
};

type ParamsContext<T extends Record<string, string>> = { params: Promise<T> };

registerRoutes([
  {
    path: API_ROUTES.analyticsData,
    handlers: {
      GET: async (request: Request) => handleAnalyticsAction(request, "data"),
    },
  },
  {
    path: API_ROUTE_PATTERNS.integrationAction,
    handlers: {
      GET: handleIntegrationData,
      POST: async (request: Request, context?: unknown) =>
        handleIntegrationActionPost(request, context as IntegrationRouteContext),
    },
  },
  {
    path: API_ROUTE_PATTERNS.integrationWebhook,
    handlers: {
      POST: async (request: Request, context?: unknown) => {
        const { integration } = await (context as ParamsContext<{ integration: string }>).params;
        return handleIntegrationWebhook(request, integration);
      },
    },
  },
  {
    path: API_ROUTES.lemonsqueezyWebhook,
    handlers: { POST: handleLemonSqueezyWebhook },
  },
  {
    path: API_ROUTES.userIntegrations,
    handlers: {
      GET: handleListUserIntegrations,
    },
  },
  {
    path: API_ROUTE_PATTERNS.userIntegration,
    handlers: {
      DELETE: async (_request: Request, context?: unknown) => {
        const { id } = await (context as ParamsContext<{ id: string }>).params;
        return handleRemoveUserIntegration(id);
      },
    },
  },
]);
