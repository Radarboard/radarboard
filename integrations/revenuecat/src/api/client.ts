/**
 * RevenueCat API v2 client for the Radarboard dashboard.
 *
 * Rate limit: 5 requests per minute for Charts & Metrics endpoints.
 * All responses are cached server-side for 5 minutes minimum.
 *
 * @see https://www.revenuecat.com/docs/api-v2
 */

import type {
  ChartDataResponse,
  ChartName,
  ChartOptionsResponse,
  Currency,
  OverviewMetric,
  OverviewMetricsResponse,
  RevenueCatConfig,
} from "../types";

const BASE_URL = "https://api.revenuecat.com/v2";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (matches rate limit constraints)

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

// --- API Client ---

class RevenueCatAPIError extends Error {
  constructor(
    public status: number,
    public type: string,
    message: string,
    public retryable: boolean,
    public backoffMs?: number
  ) {
    super(message);
    this.name = "RevenueCatAPIError";
  }
}

async function fetchRC<T>(
  config: RevenueCatConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  // Check cache first
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = errorBody as {
      type?: string;
      message?: string;
      retryable?: boolean;
      backoff_ms?: number;
    };
    throw new RevenueCatAPIError(
      response.status,
      error.type ?? "unknown_error",
      error.message ?? `HTTP ${response.status}`,
      error.retryable ?? false,
      error.backoff_ms
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * Get overview metrics for a project.
 * Returns MRR, active trials, active subscriptions, revenue, etc.
 *
 * Rate limit: 5 req/min (Charts & Metrics domain)
 * Cache TTL: 5 minutes
 */
export async function getOverviewMetrics(
  config: RevenueCatConfig,
  currency: Currency = "USD"
): Promise<OverviewMetricsResponse> {
  const cacheKey = `overview:${config.projectId}:${currency}`;
  return fetchRC<OverviewMetricsResponse>(
    config,
    `/projects/${config.projectId}/metrics/overview?currency=${currency}`,
    cacheKey
  );
}

/**
 * Get chart data for a specific metric.
 *
 * Rate limit: 5 req/min (Charts & Metrics domain)
 * Cache TTL: 5 minutes
 */
export async function getChartData(
  config: RevenueCatConfig,
  chartName: ChartName,
  options?: {
    startDate?: string;
    endDate?: string;
    resolution?: string;
    currency?: Currency;
    segment?: string;
    selectors?: Record<string, string>;
  }
): Promise<ChartDataResponse> {
  const params = new URLSearchParams();
  if (options?.startDate) params.set("start_date", options.startDate);
  if (options?.endDate) params.set("end_date", options.endDate);
  if (options?.resolution) params.set("resolution", options.resolution);
  if (options?.currency) params.set("currency", options.currency);
  if (options?.segment) params.set("segment", options.segment);
  if (options?.selectors) params.set("selectors", JSON.stringify(options.selectors));

  const query = params.toString();
  const path = `/projects/${config.projectId}/charts/${chartName}${query ? `?${query}` : ""}`;
  const cacheKey = `chart:${config.projectId}:${chartName}:${query}`;

  return fetchRC<ChartDataResponse>(config, path, cacheKey);
}

/**
 * Get available options for a chart (resolutions, segments, filters).
 * Useful for discovering what data is available.
 *
 * Rate limit: 5 req/min (Charts & Metrics domain)
 * Cache TTL: 1 hour (options rarely change)
 */
export async function getChartOptions(
  config: RevenueCatConfig,
  chartName: ChartName
): Promise<ChartOptionsResponse> {
  const cacheKey = `chart-options:${config.projectId}:${chartName}`;
  return fetchRC<ChartOptionsResponse>(
    config,
    `/projects/${config.projectId}/charts/${chartName}/options`,
    cacheKey,
    60 * 60 * 1000 // 1 hour cache
  );
}

// --- Helper: Extract specific metrics from overview ---

export function extractMetric(
  overview: OverviewMetricsResponse,
  metricId: string
): OverviewMetric | undefined {
  return overview.metrics.find((m) => m.id === metricId);
}
