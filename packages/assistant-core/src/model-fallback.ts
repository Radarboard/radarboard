/**
 * Model fallback — wraps LLM calls with circuit breaker + retry + provider switching.
 *
 * When the primary provider fails (API down, rate limited, etc.), the fallback
 * chain tries alternative providers in order. Each provider's health is tracked
 * via the circuit breaker to avoid hammering failing services.
 *
 * Uses the existing withCircuitBreaker and withRetry utilities.
 */

export interface ModelSelection {
  providerId: string;
  modelId: string;
  apiKey: string;
}

export interface FallbackConfig {
  /** Maximum retries per provider before falling back. Default: 2. */
  maxRetriesPerProvider?: number;
  /** Circuit breaker threshold (consecutive failures to open). Default: 3. */
  circuitThreshold?: number;
  /** Base retry delay in ms. Default: 1000. */
  baseRetryDelayMs?: number;
}

export interface FallbackResult<T> {
  result: T;
  /** Which provider actually served the response. */
  usedProvider: { providerId: string; modelId: string };
  /** Whether a fallback was used. */
  fellBack: boolean;
}

const DEFAULT_CONFIG: Required<FallbackConfig> = {
  maxRetriesPerProvider: 2,
  circuitThreshold: 3,
  baseRetryDelayMs: 1000,
};

// ---------------------------------------------------------------------------
// Circuit state tracking (lightweight, per-provider)
// ---------------------------------------------------------------------------

interface ProviderHealth {
  failures: number;
  lastFailedAt: number;
  cooldownMs: number;
}

const GLOBAL_KEY = "__radarboard_llm_fallback__" as const;

function getHealthMap(): Map<string, ProviderHealth> {
  const g = globalThis as unknown as Record<string, Map<string, ProviderHealth>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

function isProviderHealthy(providerId: string, config: Required<FallbackConfig>): boolean {
  const health = getHealthMap().get(providerId);
  if (!health || health.failures < config.circuitThreshold) return true;
  return Date.now() - health.lastFailedAt > health.cooldownMs;
}

function recordProviderFailure(providerId: string, config: Required<FallbackConfig>): void {
  const map = getHealthMap();
  const current = map.get(providerId) ?? {
    failures: 0,
    lastFailedAt: 0,
    cooldownMs: config.baseRetryDelayMs,
  };
  current.failures += 1;
  current.lastFailedAt = Date.now();
  current.cooldownMs = Math.min(
    config.baseRetryDelayMs * 2 ** current.failures,
    3_600_000 // 1 hour max
  );
  map.set(providerId, current);
}

function recordProviderSuccess(providerId: string): void {
  getHealthMap().delete(providerId);
}

// ---------------------------------------------------------------------------
// Retry helper (inline, simpler than withRetry for this use case)
// ---------------------------------------------------------------------------

async function retryFn<T>(fn: () => Promise<T>, maxRetries: number, baseDelay: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute an LLM call with automatic fallback to alternative providers.
 *
 * @param primary - The user's preferred provider/model
 * @param alternatives - Ordered list of fallback providers to try
 * @param fn - The LLM call to execute (receives the selected provider)
 * @param config - Fallback behavior configuration
 */
export async function withModelFallback<T>(
  primary: ModelSelection,
  alternatives: ModelSelection[],
  fn: (selection: ModelSelection) => Promise<T>,
  config: FallbackConfig = {}
): Promise<FallbackResult<T>> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Build the chain: primary first, then alternatives
  const chain = [primary, ...alternatives];

  for (let i = 0; i < chain.length; i++) {
    const selection = chain[i]!;
    const isLast = i === chain.length - 1;

    // Skip unhealthy providers (unless it's the last option)
    if (!isLast && !isProviderHealthy(selection.providerId, cfg)) {
      continue;
    }

    try {
      const result = await retryFn(
        () => fn(selection),
        isLast ? cfg.maxRetriesPerProvider : 0, // Only retry on last provider; others fail fast to fallback
        cfg.baseRetryDelayMs
      );

      recordProviderSuccess(selection.providerId);

      return {
        result,
        usedProvider: { providerId: selection.providerId, modelId: selection.modelId },
        fellBack: i > 0,
      };
    } catch {
      recordProviderFailure(selection.providerId, cfg);
      if (isLast)
        throw new Error(
          `All LLM providers failed. Last: ${selection.providerId}/${selection.modelId}`
        );
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("No LLM providers available");
}

/** Reset all provider health data (for testing). */
export function resetModelFallback(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
}
