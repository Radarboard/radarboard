/* biome-ignore-all lint/style/useNamingConvention: Route handler maps intentionally use HTTP method keys. */
import { API_ROUTE_PATTERNS, API_ROUTES } from "@radarboard/types/api-routes";
import { registerRoutes } from "@/lib/router/registry";
import { handleIntegrationOAuthCallback } from "./integration-oauth/callback";
import { handleDisabledLlmOAuth } from "./integration-oauth/disabled";
import { handleGwsImport } from "./integration-oauth/gws-import";
import { handleIntegrationProviderCallback } from "./integration-oauth/provider-callback";
import { handleIntegrationProviderRedirect } from "./integration-oauth/provider-redirect";
import { handleOAuthAuthorize, handleOAuthAuthorizeApproval } from "./mcp-oauth/authorize";
import { handleOAuthRegister } from "./mcp-oauth/register";
import { handleOAuthToken } from "./mcp-oauth/token";
import { handleListProviderAuthMethods } from "./provider-auth/methods";
import { handleOpenAiOAuthAuthorize } from "./provider-auth/openai-authorize";
import { handleOpenAiOAuthCallback } from "./provider-auth/openai-callback";
import { handleRevokeProviderOAuth } from "./provider-auth/revoke";

type ParamsContext<T extends Record<string, string>> = { params: Promise<T> };

registerRoutes([
  // --- Integration OAuth ---
  {
    path: API_ROUTE_PATTERNS.authProviderCallback,
    handlers: {
      GET: async (request: Request, context?: unknown) => {
        const { provider } = await (context as ParamsContext<{ provider: string }>).params;
        return handleIntegrationProviderCallback(request, provider);
      },
    },
  },
  {
    path: API_ROUTE_PATTERNS.authProviderRedirect,
    handlers: {
      GET: async (request: Request, context?: unknown) => {
        const { provider } = await (context as ParamsContext<{ provider: string }>).params;
        return handleIntegrationProviderRedirect(request, provider);
      },
    },
  },
  {
    path: API_ROUTES.authIntegrationsOAuth,
    handlers: { GET: handleDisabledLlmOAuth },
  },
  {
    path: API_ROUTES.authIntegrationsOAuthCallback,
    handlers: { GET: handleIntegrationOAuthCallback },
  },
  {
    path: API_ROUTES.authGwsImport,
    handlers: { POST: handleGwsImport },
  },
  // --- Provider Auth ---
  {
    path: API_ROUTES.providerAuthMethods,
    handlers: { GET: handleListProviderAuthMethods },
  },
  {
    path: API_ROUTE_PATTERNS.authProviderOAuthRevoke,
    handlers: {
      POST: async (_request: Request, context?: unknown) => {
        const { provider } = await (context as ParamsContext<{ provider: string }>).params;
        return handleRevokeProviderOAuth(provider);
      },
    },
  },
  {
    path: API_ROUTES.authOpenAiAuthorize,
    handlers: { POST: handleOpenAiOAuthAuthorize },
  },
  {
    path: API_ROUTES.authOpenAiCallback,
    handlers: { GET: handleOpenAiOAuthCallback },
  },
  // --- MCP OAuth ---
  {
    path: API_ROUTES.authMcpAuthorize,
    handlers: { GET: handleOAuthAuthorize, POST: handleOAuthAuthorizeApproval },
  },
  {
    path: API_ROUTES.authMcpRegister,
    handlers: { POST: handleOAuthRegister },
  },
  {
    path: API_ROUTES.authMcpToken,
    handlers: { POST: handleOAuthToken },
  },
]);
