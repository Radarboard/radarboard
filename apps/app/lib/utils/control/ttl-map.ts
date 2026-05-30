/**
 * TTL-aware Map with max-size eviction.
 *
 * Wraps a standard Map with:
 * - Lazy TTL expiry on `get()` — expired entries return undefined
 * - Bulk eviction on `set()` when size exceeds `maxSize` — oldest 25% removed
 * - `prune()` for explicit cleanup of all expired entries
 *
 * Used by rate-limit, health-tracker, and circuit-breaker to prevent
 * unbounded memory growth in long-running processes.
 */

interface Entry<V> {
  value: V;
  createdAt: number;
}

export interface TTLMapConfig {
  /** Maximum number of entries. When exceeded, oldest 25% are evicted. */
  maxSize: number;
  /** Time-to-live in milliseconds. Entries older than this are expired on access. */
  ttlMs: number;
}

export class TTLMap<K, V> {
  private map = new Map<K, Entry<V>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(config: TTLMapConfig) {
    this.maxSize = config.maxSize;
    this.ttlMs = config.ttlMs;
  }

  /** Get a value, returning undefined if expired or missing. */
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /** Set a value. Triggers bulk eviction if maxSize exceeded. */
  set(key: K, value: V): void {
    this.map.set(key, { value, createdAt: Date.now() });

    if (this.map.size > this.maxSize) {
      this.evictOldest();
    }
  }

  /** Check if a key exists and is not expired. */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /** Delete a specific key. */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /** Get the current number of entries (including expired ones not yet pruned). */
  get size(): number {
    return this.map.size;
  }

  /** Remove all expired entries. */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.map) {
      if (now - entry.createdAt > this.ttlMs) {
        this.map.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /** Remove all entries. */
  clear(): void {
    this.map.clear();
  }

  /** Evict the oldest 25% of entries. */
  private evictOldest(): void {
    const toEvict = Math.ceil(this.map.size * 0.25);
    const entries = [...this.map.entries()].sort(([, a], [, b]) => a.createdAt - b.createdAt);

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        this.map.delete(entry[0]);
      }
    }
  }
}
