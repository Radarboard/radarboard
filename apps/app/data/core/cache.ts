import { getCacheRepo } from "./repository";

interface CacheOptions<T> {
  key: string;
  route: string;
  ttlSeconds: number;
  fetchFn: () => Promise<T>;
  forceRefresh?: boolean;
}

interface CacheResult<T> {
  data: T;
  _stale?: boolean;
  /** Unix timestamp (seconds) when this data was fetched from the upstream source. */
  _fetchedAt?: number;
}

// ---------------------------------------------------------------------------
// In-memory cache — short-lived (10s) layer in front of the database cache.
// Eliminates repeated DB reads for the same key within rapid polling cycles.
// ---------------------------------------------------------------------------
const MEM_TTL_MS = 10_000;

interface MemEntry {
  data: string;
  fetchedAt: number;
  ttlSeconds: number;
  storedAt: number;
}

const memCache = new Map<string, MemEntry>();

function memGet(key: string): MemEntry | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > MEM_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return entry;
}

function memSet(key: string, data: string, fetchedAt: number, ttlSeconds: number): void {
  memCache.set(key, { data, fetchedAt, ttlSeconds, storedAt: Date.now() });
}

/**
 * Cache-first wrapper for API fetches. Reads from the configured cache
 * repository, calls fetchFn on miss/expiry, and falls back to stale data on error.
 *
 * Database-agnostic -- uses the CacheRepository interface, which can be
 * backed by SQLite, Supabase, PlanetScale, or any other provider.
 */
export async function withCache<T>(options: CacheOptions<T>): Promise<CacheResult<T>> {
  const { key, route, ttlSeconds, fetchFn, forceRefresh = false } = options;
  const now = Math.floor(Date.now() / 1000);
  const repo = getCacheRepo();

  // 1. Check in-memory cache first, then database (unless force refresh)
  if (!forceRefresh) {
    const mem = memGet(key);
    if (mem && mem.fetchedAt + mem.ttlSeconds > now) {
      return { data: JSON.parse(mem.data) as T, _fetchedAt: mem.fetchedAt };
    }

    try {
      const entry = await repo.get(key);

      if (entry && entry.fetchedAt + entry.ttlSeconds > now) {
        memSet(key, entry.data, entry.fetchedAt, entry.ttlSeconds);
        return { data: JSON.parse(entry.data) as T, _fetchedAt: entry.fetchedAt };
      }
    } catch {
      // Cache read failed, proceed to fetch
    }
  }

  // 2. Call external API
  try {
    const result = await fetchFn();

    // 3. Write to cache (both in-memory and database)
    const serialized = JSON.stringify(result);
    memSet(key, serialized, now, ttlSeconds);
    try {
      await repo.set({
        key,
        route,
        data: serialized,
        fetchedAt: now,
        ttlSeconds,
      });
    } catch {
      // Cache write failed, still return fresh data
    }

    return { data: result, _fetchedAt: now };
  } catch (fetchError) {
    // 4. Stale fallback -- return expired cache if available
    try {
      const staleEntry = await repo.get(key);

      if (staleEntry) {
        return {
          data: JSON.parse(staleEntry.data) as T,
          _stale: true,
          _fetchedAt: staleEntry.fetchedAt,
        };
      }
    } catch {
      // Can't read stale cache either
    }

    throw fetchError;
  }
}

/** Clear only the in-memory cache layer (useful for tests). */
export function resetMemCache(): void {
  memCache.clear();
}

/** Read a cache entry without fetching (for diagnostics). */
export async function getCacheEntry(
  key: string
): Promise<{ data: unknown; fetchedAt: number; ttlSeconds: number } | null> {
  try {
    const repo = getCacheRepo();
    const entry = await repo.get(key);
    if (!entry) return null;
    return {
      data: JSON.parse(entry.data),
      fetchedAt: entry.fetchedAt,
      ttlSeconds: entry.ttlSeconds,
    };
  } catch {
    return null;
  }
}

/** Delete all cache entries. */
export async function clearCache(): Promise<void> {
  memCache.clear();
  const repo = getCacheRepo();
  await repo.clear();
}

/** List all cache keys for a route (for cron). */
export async function getCacheKeysByRoute(route: string): Promise<string[]> {
  const repo = getCacheRepo();
  return repo.getKeysByRoute(route);
}

/** Delete all expired cache entries. Returns the number of rows removed. */
export async function deleteExpiredCache(): Promise<number> {
  const repo = getCacheRepo();
  return repo.deleteExpired();
}
