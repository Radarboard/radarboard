/**
 * Sentry REST API client for the Radarboard dashboard.
 *
 * Uses the API at https://sentry.io/api/0/
 * Authenticated via auth token (Bearer).
 *
 * Rate limit: varies by endpoint.
 * All responses are cached server-side for 2 minutes.
 *
 * @see https://docs.sentry.io/api/
 */

import type { SentryConfig, SentryIssue, SentryProject, SentryStatsPoint } from "../types";

const BASE_URL = "https://sentry.io/api/0";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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

export class SentryAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "SentryAPIError";
  }
}

// --- Fetcher ---

async function fetchSentry<T>(
  config: SentryConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.authToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new SentryAPIError(
      response.status,
      `Sentry API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * Get unresolved issues for a specific project.
 *
 * Uses the project-scoped endpoint so filtering is exact and no numeric
 * project ID is needed.
 *
 * Cache TTL: 2 minutes
 */
export async function getUnresolvedIssues(
  config: SentryConfig,
  projectSlug: string,
  options?: {
    limit?: number;
    query?: string;
  }
): Promise<SentryIssue[]> {
  const limit = options?.limit ?? 25;
  const query = options?.query ?? "is:unresolved";

  const params = new URLSearchParams({
    query,
    limit: String(limit),
    sort: "freq",
  });

  const cacheKey = `sentry:issues:${config.orgSlug}:${projectSlug}:${params.toString()}`;
  return fetchSentry<SentryIssue[]>(
    config,
    `/projects/${config.orgSlug}/${projectSlug}/issues/?${params.toString()}`,
    cacheKey
  );
}

/**
 * Get error count stats over time for a project.
 *
 * Cache TTL: 2 minutes
 */
export async function getProjectStats(
  config: SentryConfig,
  projectSlug: string,
  options?: {
    stat?: "received" | "rejected" | "blacklisted";
    resolution?: "10s" | "1h" | "1d";
    since?: number;
  }
): Promise<SentryStatsPoint[]> {
  const stat = options?.stat ?? "received";
  const resolution = options?.resolution ?? "1h";
  const since = options?.since ?? Math.floor(Date.now() / 1000) - 24 * 60 * 60;

  const params = new URLSearchParams({
    stat,
    resolution,
    since: String(since),
  });

  const cacheKey = `sentry:stats:${config.orgSlug}:${projectSlug}:${params.toString()}`;
  const data = await fetchSentry<number[][]>(
    config,
    `/projects/${config.orgSlug}/${projectSlug}/stats/?${params.toString()}`,
    cacheKey
  );

  return data.map(([ts, count]) => ({ ts: ts ?? 0, count: count ?? 0 }));
}

/**
 * Get all projects in the organization.
 *
 * Cache TTL: 10 minutes (projects rarely change)
 */
export async function getProjects(config: SentryConfig): Promise<SentryProject[]> {
  const cacheKey = `sentry:projects:${config.orgSlug}`;
  return fetchSentry<SentryProject[]>(
    config,
    `/organizations/${config.orgSlug}/projects/`,
    cacheKey,
    10 * 60 * 1000
  );
}
