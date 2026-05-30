import type { RouteTarget } from "@radarboard/types/api-routes";
import { createLogger } from "./logger";

type RouteHandler = (request: Request, context?: unknown) => Promise<Response> | Response;

/**
 * Wrap a Next.js API route handler with automatic request logging.
 *
 * Logs request start (method + path), completion (status + duration in ms),
 * and any unhandled errors.
 *
 * @example
 * ```ts
 * import { API_ROUTES } from "@radarboard/types/api-routes";
 * import { withLogging } from "@radarboard/logger/middleware";
 *
 * export const GET = withLogging(API_ROUTES.settings, async () => {
 *   const data = await fetchHealthData();
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withLogging(name: RouteTarget, handler: RouteHandler): RouteHandler {
  const log = createLogger(name);

  return async (request: Request, context?: unknown) => {
    const start = performance.now();
    const { method } = request;
    const url = new URL(request.url);

    log.info("request started", { method, path: url.pathname });

    try {
      const response = await handler(request, context);
      const duration = Math.round(performance.now() - start);
      log.info("request completed", {
        method,
        path: url.pathname,
        status: response.status,
        duration,
      });
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      log.error("request failed", {
        method,
        path: url.pathname,
        duration,
        error,
      });
      throw error;
    }
  };
}
