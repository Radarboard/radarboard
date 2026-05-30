import type { RouteTarget } from "@radarboard/types/api-routes";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type RouteHandler = (request: Request, context?: unknown) => Response | Promise<Response>;

export interface RouteDefinition {
  /** Canonical URL path or shared dynamic route pattern. */
  path: RouteTarget;
  handlers: Partial<Record<HttpMethod, RouteHandler>>;
}

export interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
  routePath: RouteTarget;
}
