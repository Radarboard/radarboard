/**
 * Request coalescing — deduplicates concurrent calls with the same key.
 *
 * If a promise is already in-flight for a key, `withCoalesce` returns
 * the existing promise instead of calling `fn` again. When the promise
 * settles, the key is removed so the next call gets a fresh execution.
 *
 * This is a lightweight inflight-request dedup, not a cache.
 */

const inflight = new Map<string, Promise<unknown>>();

/**
 * Execute `fn` with request coalescing.
 * Concurrent calls with the same key share a single execution.
 *
 * @example
 * ```ts
 * // These 3 calls result in only 1 fetchFn execution
 * const [a, b, c] = await Promise.all([
 *   withCoalesce("github:pulls", fetchPulls),
 *   withCoalesce("github:pulls", fetchPulls),
 *   withCoalesce("github:pulls", fetchPulls),
 * ]);
 * ```
 */
export function withCoalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/** Get the number of in-flight keys (for testing/debugging). */
export function getInflightCount(): number {
  return inflight.size;
}

/** Reset all in-flight state (for testing). */
export function resetCoalesce(): void {
  inflight.clear();
}
