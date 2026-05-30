/**
 * Google Search Console API client for the Radarboard dashboard.
 *
 * Uses the Search Console API v1 with OAuth2 refresh tokens.
 * Access tokens are automatically refreshed when expired.
 *
 * All responses are cached server-side for 5 minutes.
 *
 * @see https://developers.google.com/webmaster-tools/v1/api_reference_index
 */

import type {
  GSCConfig,
  GSCSite,
  GSCSiteListResponse,
  SearchAnalyticsResponse,
  SearchDimension,
} from "../types";

const SEARCH_ANALYTICS_URL = "https://searchconsole.googleapis.com/webmasters/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

// --- Token Management ---

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(config: GSCConfig): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GSCAPIError(response.status, `Token refresh failed: ${errorBody}`, true);
  }

  const token = (await response.json()) as TokenResponse;
  accessToken = token.access_token;
  // Refresh 60 seconds before actual expiry
  tokenExpiresAt = Date.now() + (token.expires_in - 60) * 1000;

  return accessToken;
}

// --- Error ---

export class GSCAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "GSCAPIError";
  }
}

// --- Fetchers ---

async function fetchGSC<T>(
  config: GSCConfig,
  path: string,
  body: Record<string, unknown>,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const token = await getAccessToken(config);

  const url = `${SEARCH_ANALYTICS_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GSCAPIError(
      response.status,
      `GSC API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

/**
 * Shared GET helper — mirrors fetchGSC but for GET endpoints.
 * Routes through the same cache helpers to avoid duplicated cache logic.
 */
async function fetchGSCGet<T>(
  config: GSCConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const token = await getAccessToken(config);
  const url = `${SEARCH_ANALYTICS_URL}${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GSCAPIError(
      response.status,
      `GSC API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * List all sites the authenticated user has access to in Search Console.
 *
 * Cache TTL: 5 minutes
 */
export async function listSites(config: GSCConfig): Promise<GSCSite[]> {
  const data = await fetchGSCGet<GSCSiteListResponse>(config, "/sites", "gsc:sites");
  return data.siteEntry ?? [];
}

/**
 * Get search analytics data for a site.
 * Returns queries with clicks, impressions, CTR, and position.
 *
 * Cache TTL: 5 minutes
 */
export async function getSearchAnalytics(
  config: GSCConfig,
  siteUrl: string,
  options?: {
    startDate?: string;
    endDate?: string;
    dimensions?: SearchDimension[];
    rowLimit?: number;
  }
): Promise<SearchAnalyticsResponse> {
  const now = new Date();
  // GSC data has a 2-3 day delay
  const defaultEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const defaultStart = new Date(defaultEnd.getTime() - 28 * 24 * 60 * 60 * 1000);

  const startDate = options?.startDate ?? defaultStart.toISOString().split("T")[0];
  const endDate = options?.endDate ?? defaultEnd.toISOString().split("T")[0];
  const dimensions = options?.dimensions ?? ["query"];
  const rowLimit = options?.rowLimit ?? 25;

  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    dataState: "final",
  };

  const cacheKey = `gsc:analytics:${siteUrl}:${JSON.stringify(body)}`;
  const encodedSiteUrl = encodeURIComponent(siteUrl);

  return fetchGSC<SearchAnalyticsResponse>(
    config,
    `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    body,
    cacheKey
  );
}

/**
 * Get search analytics grouped by date for trend data.
 *
 * Cache TTL: 5 minutes
 */
export async function getSearchAnalyticsByDate(
  config: GSCConfig,
  siteUrl: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<SearchAnalyticsResponse> {
  return getSearchAnalytics(config, siteUrl, {
    ...options,
    dimensions: ["date"],
    rowLimit: 90,
  });
}

/**
 * Get search analytics for a specific query, broken down by a given dimension.
 *
 * Uses the GSC dimensionFilterGroups to scope results to one query, then groups
 * by date / page / device / country. Used for the per-query detail modal.
 *
 * Cache TTL: 5 minutes (in-memory); caller should also use withCache for DB persistence.
 */
export async function getSearchAnalyticsForQuery(
  config: GSCConfig,
  siteUrl: string,
  query: string,
  dimension: Exclude<SearchDimension, "query">,
  options?: {
    startDate?: string;
    endDate?: string;
    rowLimit?: number;
  }
): Promise<SearchAnalyticsResponse> {
  const now = new Date();
  const defaultEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const defaultStart = new Date(defaultEnd.getTime() - 28 * 24 * 60 * 60 * 1000);

  const startDate = options?.startDate ?? defaultStart.toISOString().split("T")[0];
  const endDate = options?.endDate ?? defaultEnd.toISOString().split("T")[0];
  const rowLimit = options?.rowLimit ?? (dimension === "date" ? 90 : 10);

  const body = {
    startDate,
    endDate,
    dimensions: [dimension],
    rowLimit,
    dataState: "final",
    dimensionFilterGroups: [
      {
        groupType: "and",
        filters: [
          {
            dimension: "query",
            operator: "equals",
            expression: query,
          },
        ],
      },
    ],
  };

  const cacheKey = `gsc:query-detail:${siteUrl}:${query}:${dimension}:${startDate}:${endDate}`;
  const encodedSiteUrl = encodeURIComponent(siteUrl);

  return fetchGSC<SearchAnalyticsResponse>(
    config,
    `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    body,
    cacheKey
  );
}
