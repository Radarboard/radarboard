/**
 * BetterStack Uptime API client for the Radarboard dashboard.
 *
 * Uses the REST API at https://uptime.betterstack.com/api/v2/
 * Authenticated via Bearer token.
 *
 * All responses are cached server-side for 1 minute.
 *
 * @see https://betterstack.com/docs/uptime/api/
 */

import type {
  BetterStackConfig,
  BetterStackHeartbeat,
  BetterStackIncident,
  BetterStackMonitor,
} from "../types";

const BASE_URL = "https://uptime.betterstack.com/api/v2";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Evict all in-memory cache entries whose key starts with the given prefix. */
export function evictCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// --- Error ---

export class BetterStackAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "BetterStackAPIError";
  }
}

// --- Fetcher ---

async function fetchBS<T>(
  config: BetterStackConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new BetterStackAPIError(
      response.status,
      `BetterStack API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * Get all monitors with their current status.
 *
 * Cache TTL: 1 minute
 */
export async function getMonitors(config: BetterStackConfig): Promise<BetterStackMonitor[]> {
  const cacheKey = "bs:monitors";
  const data = await fetchBS<{ data: BetterStackMonitor[] }>(config, "/monitors", cacheKey);
  return data.data;
}

/**
 * Get recent incidents (ongoing and resolved).
 *
 * Cache TTL: 1 minute
 */
export async function getIncidents(
  config: BetterStackConfig,
  options?: {
    limit?: number;
  }
): Promise<BetterStackIncident[]> {
  const limit = options?.limit ?? 20;
  const cacheKey = `bs:incidents:${limit}`;
  const data = await fetchBS<{ data: BetterStackIncident[] }>(
    config,
    `/incidents?per_page=${limit}`,
    cacheKey
  );
  return data.data;
}

/**
 * Get heartbeat monitors.
 *
 * Cache TTL: 1 minute
 */
export async function getHeartbeats(config: BetterStackConfig): Promise<BetterStackHeartbeat[]> {
  const cacheKey = "bs:heartbeats";
  const data = await fetchBS<{ data: BetterStackHeartbeat[] }>(config, "/heartbeats", cacheKey);
  return data.data;
}
