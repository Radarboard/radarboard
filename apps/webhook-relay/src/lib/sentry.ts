/**
 * Error reporting and Hono middleware.
 *
 * Uses console.error/console.warn for logging — Vercel captures these
 * in runtime logs. @sentry/node was removed because its OpenTelemetry
 * dependency causes cold-start timeouts in serverless functions.
 *
 * The interface is preserved so Sentry can be re-added later with a
 * lighter SDK (@sentry/core or dynamic import).
 */

import type { Context, MiddlewareHandler } from "hono";

/** Report an error with request context. Logs to Vercel runtime logs. */
export function captureError(error: unknown, c: Context): void {
  // biome-ignore lint/suspicious/noConsole: intentional — Vercel runtime logs capture console output
  console.error("[relay] error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    path: c.req.path,
    method: c.req.method,
    integration: c.req.param("integration") ?? "unknown",
  });
}

/** Log a non-fatal warning. */
export function captureWarning(message: string, extra?: Record<string, unknown>): void {
  // biome-ignore lint/suspicious/noConsole: intentional — Vercel runtime logs capture console output
  console.warn("[relay] warning", message, extra);
}

/** No-op — kept for interface compatibility. */
// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op stub
export async function flushSentry(): Promise<void> {}

/**
 * Hono middleware that captures unhandled errors, then re-throws
 * so Hono's onError handler can return a clean 500 response.
 */
export function sentryMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      captureError(error, c);
      throw error;
    }
  };
}

/** No-op flush middleware — kept for interface compatibility. */
export function sentryFlushMiddleware(): MiddlewareHandler {
  return async (_c, next) => {
    await next();
  };
}
