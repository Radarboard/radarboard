/**
 * Retry with exponential backoff.
 *
 * Wraps an async function with configurable retry logic: max attempts,
 * exponential backoff with jitter, and a shouldRetry predicate.
 */

export interface RetryConfig {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Base delay in ms for backoff. Default: 1000. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 30000 (30s). */
  maxDelayMs?: number;
  /** Predicate — return false to stop retrying. Default: retry on all errors. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  shouldRetry: () => true,
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Calculate backoff with jitter: baseDelay * 2^attempt + random jitter. */
function getBackoffMs(attempt: number, config: Required<RetryConfig>): number {
  const exponential = config.baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * config.baseDelayMs * 0.5;
  return Math.min(exponential + jitter, config.maxDelayMs);
}

/**
 * Execute `fn` with retry on failure.
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetch("/api/settings", { method: "POST", body }),
 *   {
 *     maxAttempts: 3,
 *     shouldRetry: (err) => !(err instanceof Response && err.status < 500),
 *   }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  let lastError: unknown;

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === cfg.maxAttempts - 1;
      if (isLastAttempt || !cfg.shouldRetry(err, attempt)) {
        throw err;
      }

      const backoff = getBackoffMs(attempt, cfg);
      await delay(backoff);
    }
  }

  throw lastError;
}
