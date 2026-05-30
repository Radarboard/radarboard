/**
 * In-memory token bucket rate limiter.
 *
 * Tracks request counts per IP (or a fallback key) using a token bucket.
 * Use `withRateLimit` to wrap individual route handlers, or `checkRateLimit`
 * for manual checking.
 */

import { NextResponse } from "next/server";

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

const GLOBAL_KEY = "__radarboard_rate_limit__" as const;

function getBuckets(): Map<string, BucketEntry> {
  const g = globalThis as unknown as Record<string, Map<string, BucketEntry>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, BucketEntry>();
  }
  return g[GLOBAL_KEY];
}

export interface RateLimitConfig {
  /** Maximum tokens (requests) in the bucket. */
  maxTokens: number;
  /** Tokens added per second. */
  refillRate: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokens: 60,
  refillRate: 2, // 2 req/s sustained, burst to 60
};

/**
 * Check if a request should be allowed.
 * Returns `{ allowed: true, remaining }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: true; remaining: number } | { allowed: false; retryAfterMs: number } {
  const buckets = getBuckets();
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry) {
    entry = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, entry);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(config.maxTokens, entry.tokens + elapsed * config.refillRate);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return { allowed: true, remaining: Math.floor(entry.tokens) };
  }

  // Calculate when 1 token will be available
  const deficit = 1 - entry.tokens;
  const retryAfterMs = Math.ceil((deficit / config.refillRate) * 1000);
  return { allowed: false, retryAfterMs };
}

// ---------------------------------------------------------------------------
// Route handler wrapper
// ---------------------------------------------------------------------------

type RouteHandler = (request: Request, context?: unknown) => Promise<Response> | Response;

function getClientKey(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown"
  );
}

/**
 * Wrap a Next.js API route handler with rate limiting.
 * Returns 429 if the client exceeds the configured rate.
 *
 * @example
 * ```ts
 * export const GET = withRateLimit(async (request) => {
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withRateLimit(handler: RouteHandler, config?: RateLimitConfig): RouteHandler {
  return async (request: Request, context?: unknown) => {
    const clientKey = getClientKey(request);
    const result = checkRateLimit(clientKey, config);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
          },
        }
      );
    }

    const response = await handler(request, context);
    // Add rate limit header to successful responses
    if (response instanceof NextResponse) {
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    }
    return response;
  };
}

/** Reset all rate limit data (for testing). */
export function resetRateLimitData(): void {
  getBuckets().clear();
}
