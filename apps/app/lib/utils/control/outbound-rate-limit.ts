/**
 * Outbound rate limiter for integration API calls.
 *
 * Uses the same token bucket algorithm as the inbound rate limiter
 * but configured per integration to prevent API key bans from
 * excessive polling.
 */

export class OutboundRateLimitError extends Error {
  readonly integrationKey: string;
  readonly retryAfterMs: number;

  constructor(key: string, retryAfterMs: number) {
    super(
      `Outbound rate limit reached for "${key}" — retry after ${Math.ceil(retryAfterMs / 1000)}s`
    );
    this.name = "OutboundRateLimitError";
    this.integrationKey = key;
    this.retryAfterMs = retryAfterMs;
  }
}

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

export interface OutboundRateLimitConfig {
  /** Maximum tokens (requests) in the bucket. */
  maxTokens: number;
  /** Tokens added per second. */
  refillRate: number;
}

/** Per-integration rate limit configs. */
const INTEGRATION_LIMITS: Record<string, OutboundRateLimitConfig> = {
  github: { maxTokens: 80, refillRate: 1.4 }, // 5000/hr
  "github-sponsors": { maxTokens: 80, refillRate: 1.4 },
  "app-store-connect": { maxTokens: 8, refillRate: 0.14 }, // 500/hr
  sentry: { maxTokens: 30, refillRate: 0.5 }, // ~1800/hr
  vercel: { maxTokens: 15, refillRate: 0.28 }, // ~1000/hr
  linear: { maxTokens: 25, refillRate: 0.42 }, // ~1500/hr
  openpanel: { maxTokens: 10, refillRate: 0.17 }, // ~600/hr
  revenuecat: { maxTokens: 5, refillRate: 0.08 }, // ~300/hr
  npm: { maxTokens: 50, refillRate: 0.83 }, // ~3000/hr
  raindrop: { maxTokens: 20, refillRate: 0.33 }, // ~1200/hr
  "google-search-console": { maxTokens: 15, refillRate: 0.28 },
  resend: { maxTokens: 10, refillRate: 0.17 },
  betterstack: { maxTokens: 10, refillRate: 0.17 },
  discord: { maxTokens: 40, refillRate: 40 }, // 40 req/s
  "open-collective": { maxTokens: 10, refillRate: 0.17 },
  slack: { maxTokens: 5, refillRate: 0.08 }, // ~5/min
  stripe: { maxTokens: 15, refillRate: 0.28 }, // ~1000/hr
  umami: { maxTokens: 15, refillRate: 0.28 }, // ~1000/hr
  pagerduty: { maxTokens: 15, refillRate: 0.28 }, // ~1000/hr
};

const DEFAULT_LIMIT: OutboundRateLimitConfig = {
  maxTokens: 30,
  refillRate: 0.5,
};

const GLOBAL_KEY = "__radarboard_outbound_rate_limit__" as const;

function getBuckets(): Map<string, BucketEntry> {
  const g = globalThis as unknown as Record<string, Map<string, BucketEntry>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

function checkBucket(
  key: string,
  config: OutboundRateLimitConfig
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const buckets = getBuckets();
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry) {
    entry = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, entry);
  }

  const elapsed = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(config.maxTokens, entry.tokens + elapsed * config.refillRate);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return { allowed: true };
  }

  const deficit = 1 - entry.tokens;
  const retryAfterMs = Math.ceil((deficit / config.refillRate) * 1000);
  return { allowed: false, retryAfterMs };
}

/**
 * Execute `fn` with outbound rate limiting for the given integration.
 * Throws `OutboundRateLimitError` when the budget is exhausted.
 */
export async function withOutboundRateLimit<T>(
  integrationKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const config = INTEGRATION_LIMITS[integrationKey] ?? DEFAULT_LIMIT;
  const result = checkBucket(integrationKey, config);

  if (!result.allowed) {
    throw new OutboundRateLimitError(integrationKey, result.retryAfterMs);
  }

  return fn();
}

/** Reset all outbound rate limit data (for testing). */
export function resetOutboundRateLimits(): void {
  getBuckets().clear();
}
