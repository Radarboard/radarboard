/**
 * Per-session async mutex for serializing concurrent mutations.
 *
 * Prevents race conditions when two browser tabs or concurrent SWR
 * revalidation cycles fire mutations against the same resource
 * (settings save, widget layout update, plugin DB write).
 *
 * Uses a promise-chain queue keyed by `sessionId:resource`. Each
 * `withSessionLock(key, fn)` call waits for the previous holder
 * to complete before executing.
 */

const locks = new Map<string, Promise<void>>();

/**
 * Execute `fn` while holding an exclusive lock for the given key.
 * Concurrent calls with the same key are serialized; different keys
 * run independently.
 *
 * @example
 * ```ts
 * await withSessionLock(`${sessionId}:settings`, async () => {
 *   const current = await loadSettings();
 *   current.layout = newLayout;
 *   await saveSettings(current);
 * });
 * ```
 */
export async function withSessionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Chain onto the existing lock (or start fresh)
  const previous = locks.get(key) ?? Promise.resolve();

  let resolve: (() => void) | undefined;
  const next = new Promise<void>((r) => {
    resolve = r;
  });

  // Register our slot in the queue before awaiting
  locks.set(key, next);

  // Wait for the previous holder to finish
  await previous;

  try {
    return await fn();
  } finally {
    // Release the lock — allow the next queued caller to proceed
    resolve?.();

    // Clean up if we're the last in the queue
    if (locks.get(key) === next) {
      locks.delete(key);
    }
  }
}

/** Get the number of active lock keys (for testing/debugging). */
export function getActiveLockCount(): number {
  return locks.size;
}

/** Reset all locks (for testing). */
export function resetLocks(): void {
  locks.clear();
}
