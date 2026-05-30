import type { HttpMethod, RouteDefinition, RouteHandler, RouteMatch } from "./types";

/**
 * Two-tier route registry:
 * 1. Static map for exact-match paths (O(1) lookup, covers ~80% of routes)
 * 2. Pattern list for dynamic routes with :param segments (checked in order)
 */

const staticRoutes = new Map<
  string,
  {
    handlers: Partial<Record<HttpMethod, RouteHandler>>;
    path: RouteDefinition["path"];
  }
>();

interface DynamicRoute {
  path: RouteDefinition["path"];
  segments: string[];
  paramIndices: Map<number, string>; // index → param name
  handlers: Partial<Record<HttpMethod, RouteHandler>>;
}

const dynamicRoutes: DynamicRoute[] = [];

function isDynamic(path: string): boolean {
  return path.includes(":");
}

function compileDynamic(def: RouteDefinition): DynamicRoute {
  const segments = def.path.split("/").filter(Boolean);
  const paramIndices = new Map<number, string>();
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment?.startsWith(":")) {
      paramIndices.set(i, segment.slice(1));
    }
  }
  return { path: def.path, segments, paramIndices, handlers: def.handlers };
}

function matchDynamic(pathSegments: string[], route: DynamicRoute): Record<string, string> | null {
  if (pathSegments.length !== route.segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i++) {
    const paramName = route.paramIndices.get(i);
    const routeSegment = route.segments[i];
    const pathSegment = pathSegments[i];
    if (!routeSegment || pathSegment === undefined) {
      return null;
    }
    if (paramName) {
      params[paramName] = decodeURIComponent(pathSegment);
    } else if (routeSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

export function registerRoutes(definitions: RouteDefinition[]): void {
  for (const def of definitions) {
    if (isDynamic(def.path)) {
      dynamicRoutes.push(compileDynamic(def));
    } else {
      const existing = staticRoutes.get(def.path);
      if (existing) {
        Object.assign(existing.handlers, def.handlers);
      } else {
        staticRoutes.set(def.path, { handlers: { ...def.handlers }, path: def.path });
      }
    }
  }
}

export function matchRoute(pathname: string, method: HttpMethod): RouteMatch | null {
  // 1. Try static match first (fast path)
  const staticRoute = staticRoutes.get(pathname);
  if (staticRoute) {
    const handler = staticRoute.handlers[method];
    if (handler) return { handler, params: {}, routePath: staticRoute.path };
    return null; // path matched but method not allowed
  }

  // 2. Try dynamic routes
  const segments = pathname.split("/").filter(Boolean);
  for (const route of dynamicRoutes) {
    const params = matchDynamic(segments, route);
    if (params) {
      const handler = route.handlers[method];
      if (handler) return { handler, params, routePath: route.path };
      return null;
    }
  }

  return null;
}

export function hasRoute(pathname: string): boolean {
  if (staticRoutes.has(pathname)) return true;

  const segments = pathname.split("/").filter(Boolean);
  for (const route of dynamicRoutes) {
    if (matchDynamic(segments, route)) return true;
  }
  return false;
}
