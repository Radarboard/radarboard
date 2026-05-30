/**
 * Catch-all API dispatcher.
 *
 * Routes registered via `registerRoutes()` in feature modules are matched here.
 * Next.js resolves specific `app/api/` files before this catch-all, so migration
 * is incremental — unregistered routes continue using their existing route files.
 */

import { createLogger } from "@radarboard/logger/logger";
import { hasRoute, matchRoute } from "@/lib/router/registry";
import { emitRouteOutcome, runRouteWithDebug } from "@/lib/router/route-debug";
import type { HttpMethod } from "@/lib/router/types";

// Import all module route registrations (side-effect: calls registerRoutes)
import "@/lib/router/routes";

const log = createLogger("api/catchall");

async function dispatch(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const method = request.method as HttpMethod;

    const match = matchRoute(url.pathname, method);

    if (!match) {
      // Distinguish "path not found" from "method not allowed"
      if (hasRoute(url.pathname)) {
        await emitRouteOutcome({
          actualPath: url.pathname,
          method,
          routePath: url.pathname,
          statusCode: 405,
        });
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }
      await emitRouteOutcome({
        actualPath: url.pathname,
        method,
        routePath: url.pathname,
        statusCode: 404,
      });
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build context matching Next.js convention for dynamic params
    const context =
      Object.keys(match.params).length > 0 ? { params: Promise.resolve(match.params) } : undefined;

    return runRouteWithDebug({
      actualPath: url.pathname,
      context,
      handler: match.handler,
      method,
      params: match.params,
      request,
      routePath: match.routePath,
    });
  } catch (error) {
    log.error("Catch-all API dispatch failed", { error });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
export const PATCH = dispatch;
