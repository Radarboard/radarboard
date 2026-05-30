/**
 * PagerDuty REST API client.
 *
 * Uses the PagerDuty REST API v2 at https://api.pagerduty.com
 * Authenticated via API token (Bearer).
 *
 * @see https://developer.pagerduty.com/api-reference
 */

import type {
  PagerDutyConfig,
  PagerDutyIncident,
  PagerDutyOnCall,
  PagerDutyService,
} from "../types";

const BASE_URL = "https://api.pagerduty.com";

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

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --- Error ---

export class PagerDutyAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "PagerDutyAPIError";
  }
}

// --- Fetcher ---

async function fetchPD<T>(
  config: PagerDutyConfig,
  path: string,
  params?: Record<string, string>,
  cacheKey?: string
): Promise<T> {
  const key = cacheKey ?? `pd:${path}:${JSON.stringify(params)}`;
  const cached = getCached<T>(key);
  if (cached) return cached;

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token token=${config.apiToken}`,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new PagerDutyAPIError(
      response.status,
      `PagerDuty API error ${response.status}: ${errorBody.slice(0, 200)}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(key, data);
  return data;
}

// --- Public API ---

/**
 * Get active incidents (triggered + acknowledged).
 */
export async function getActiveIncidents(
  config: PagerDutyConfig,
  limit = 25
): Promise<PagerDutyIncident[]> {
  const result = await fetchPD<{ incidents: PagerDutyIncident[] }>(config, "/incidents", {
    "statuses[]": "triggered,acknowledged",
    limit: limit.toString(),
    sort_by: "created_at:desc",
  });
  return result.incidents;
}

/**
 * Get recent resolved incidents.
 */
export async function getRecentIncidents(
  config: PagerDutyConfig,
  limit = 25
): Promise<PagerDutyIncident[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const result = await fetchPD<{ incidents: PagerDutyIncident[] }>(config, "/incidents", {
    since: since.toISOString(),
    limit: limit.toString(),
    sort_by: "created_at:desc",
  });
  return result.incidents;
}

/**
 * Get all services with their current status.
 */
export async function getServices(config: PagerDutyConfig): Promise<PagerDutyService[]> {
  const result = await fetchPD<{ services: PagerDutyService[] }>(config, "/services", {
    limit: "100",
  });
  return result.services;
}

/**
 * Get current on-call users.
 */
export async function getOnCalls(config: PagerDutyConfig): Promise<PagerDutyOnCall[]> {
  const result = await fetchPD<{ oncalls: PagerDutyOnCall[] }>(config, "/oncalls", { limit: "50" });
  return result.oncalls;
}
