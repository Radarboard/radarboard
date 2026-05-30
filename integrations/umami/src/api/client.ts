/**
 * Umami API client for the Radarboard dashboard.
 *
 * Uses the Umami REST API (self-hosted or cloud).
 * Authenticated via Bearer token (API key).
 *
 * @see https://umami.is/docs/api
 */

import type {
  UmamiActiveVisitors,
  UmamiConfig,
  UmamiMetric,
  UmamiPageviewsTimeSeries,
  UmamiStats,
} from "../types";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --- Error ---

export class UmamiAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "UmamiAPIError";
  }
}

// --- Fetcher ---

async function fetchUmami<T>(
  config: UmamiConfig,
  path: string,
  params?: Record<string, string>,
  cacheKey?: string
): Promise<T> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const key = cacheKey ?? `umami:${path}:${JSON.stringify(params)}`;
  const cached = getCached<T>(key);
  if (cached) return cached;

  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new UmamiAPIError(
      response.status,
      `Umami API error ${response.status}: ${errorBody.slice(0, 200)}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(key, data);
  return data;
}

// --- Helpers ---

function defaultRange(): { startAt: string; endAt: string } {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return {
    startAt: thirtyDaysAgo.toString(),
    endAt: now.toString(),
  };
}

// --- Public API ---

/**
 * Get website stats (pageviews, visitors, visits, bounces, totaltime).
 */
export async function getStats(
  config: UmamiConfig,
  startAt?: number,
  endAt?: number
): Promise<UmamiStats> {
  const range = defaultRange();
  return fetchUmami<UmamiStats>(
    config,
    `/api/websites/${config.websiteId}/stats`,
    {
      startAt: startAt?.toString() ?? range.startAt,
      endAt: endAt?.toString() ?? range.endAt,
    },
    `umami:stats:${config.websiteId}`
  );
}

/**
 * Get current active visitors.
 */
export async function getActiveVisitors(config: UmamiConfig): Promise<UmamiActiveVisitors> {
  return fetchUmami<UmamiActiveVisitors>(
    config,
    `/api/websites/${config.websiteId}/active`,
    undefined,
    `umami:active:${config.websiteId}`
  );
}

/**
 * Get pageview time series (pageviews + sessions by day).
 */
export async function getPageviews(
  config: UmamiConfig,
  startAt?: number,
  endAt?: number,
  unit = "day"
): Promise<UmamiPageviewsTimeSeries> {
  const range = defaultRange();
  return fetchUmami<UmamiPageviewsTimeSeries>(
    config,
    `/api/websites/${config.websiteId}/pageviews`,
    {
      startAt: startAt?.toString() ?? range.startAt,
      endAt: endAt?.toString() ?? range.endAt,
      unit,
    },
    `umami:pageviews:${config.websiteId}:${unit}`
  );
}

/**
 * Get metrics by type (url, browser, device, country, referrer).
 */
export async function getMetrics(
  config: UmamiConfig,
  type: "url" | "browser" | "device" | "country" | "referrer",
  startAt?: number,
  endAt?: number
): Promise<UmamiMetric[]> {
  const range = defaultRange();
  return fetchUmami<UmamiMetric[]>(
    config,
    `/api/websites/${config.websiteId}/metrics`,
    {
      startAt: startAt?.toString() ?? range.startAt,
      endAt: endAt?.toString() ?? range.endAt,
      type,
    },
    `umami:metrics:${config.websiteId}:${type}`
  );
}
