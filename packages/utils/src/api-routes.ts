import {
  type ApiRoute,
  type ApiRoutePattern,
  chatConversationExtractRoute as buildChatConversationExtractRoute,
  chatConversationRoute as buildChatConversationRoute,
  integrationRoute as buildIntegrationRoute,
  knowledgeHealthItemRoute as buildKnowledgeHealthItemRoute,
  knowledgeHealthProjectRoute as buildKnowledgeHealthProjectRoute,
  pluginDataListRoute as buildPluginDataListRoute,
  pluginDataRoute as buildPluginDataRoute,
  pluginRoute as buildPluginRoute,
  API_ROUTE_PATTERNS as CANONICAL_API_ROUTE_PATTERNS,
  API_ROUTES as CANONICAL_API_ROUTES,
  type IntegrationActionRoute,
  type PluginActionRoute,
  type RouteTarget,
} from "@radarboard/types/api-routes";

export type { ApiRoute, ApiRoutePattern, IntegrationActionRoute, PluginActionRoute, RouteTarget };

type ApiRouteMap = { readonly [K in keyof typeof CANONICAL_API_ROUTES]: ApiRoute };
type ApiRoutePatternMap = {
  readonly [K in keyof typeof CANONICAL_API_ROUTE_PATTERNS]: ApiRoutePattern;
};

export const API_ROUTES: ApiRouteMap = CANONICAL_API_ROUTES;
export const API_ROUTE_PATTERNS: ApiRoutePatternMap = CANONICAL_API_ROUTE_PATTERNS;

export function integrationRoute<const TIntegration extends string, const TAction extends string>(
  integration: TIntegration,
  action: TAction
): IntegrationActionRoute<TIntegration, TAction> {
  return buildIntegrationRoute(integration, action);
}

export function pluginRoute<const TPlugin extends string, const TAction extends string>(
  plugin: TPlugin,
  action: TAction
): PluginActionRoute<TPlugin, TAction> {
  return buildPluginRoute(plugin, action);
}

export function pluginDataRoute(pluginId: string, key: string): string {
  return buildPluginDataRoute(pluginId, key);
}

export function pluginDataListRoute(pluginId: string, prefix?: string): string {
  return buildPluginDataListRoute(pluginId, prefix);
}

export function chatConversationRoute(conversationId: string): string {
  return buildChatConversationRoute(conversationId);
}

export function chatConversationExtractRoute(conversationId: string): string {
  return buildChatConversationExtractRoute(conversationId);
}

export function knowledgeHealthItemRoute(itemId: string): string {
  return buildKnowledgeHealthItemRoute(itemId);
}

export function knowledgeHealthProjectRoute(projectSlug: string): string {
  return buildKnowledgeHealthProjectRoute(projectSlug);
}
