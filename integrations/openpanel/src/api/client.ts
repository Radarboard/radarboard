/**
 * OpenPanel Insights + Export API client for the Radarboard dashboard.
 *
 * Rate limit: 100 requests per 10 seconds.
 * Responses cached for 60 seconds server-side.
 *
 * @see https://openpanel.dev/docs/api/insights
 * @see https://openpanel.dev/docs/api/export
 */

import type {
  CountryItem,
  InsightsMetricsResponse,
  LiveVisitorsResponse,
  ManagedProject,
  ManagedProjectListItem,
  OpenPanelConfig,
  ReferrerItem,
  TopPage,
} from "../types";

const BASE_URL = "https://api.openpanel.dev";
const MANAGE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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

function setCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// --- Error ---

export class OpenPanelAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "OpenPanelAPIError";
  }
}

// --- Fetcher ---

async function fetchOP<T>(
  config: OpenPanelConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "openpanel-client-id": config.clientId,
      "openpanel-client-secret": config.clientSecret,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new OpenPanelAPIError(
      response.status,
      `OpenPanel API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * Get comprehensive metrics (visitors, sessions, page views, bounce rate, etc.)
 */
export async function getMetrics(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {}
): Promise<InsightsMetricsResponse> {
  const params = new URLSearchParams();
  if (options.range) params.set("range", options.range);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);
  const query = params.toString();
  const cacheKey = `op:metrics:${config.projectId}:${query}`;
  return fetchOP<InsightsMetricsResponse>(
    config,
    `/insights/${config.projectId}/metrics?${query}`,
    cacheKey
  );
}

/**
 * Get current live visitor count.
 */
export async function getLiveVisitors(config: OpenPanelConfig): Promise<LiveVisitorsResponse> {
  const cacheKey = `op:live:${config.projectId}`;
  return fetchOP<LiveVisitorsResponse>(
    config,
    `/insights/${config.projectId}/live`,
    cacheKey,
    15 * 1000 // 15 second cache for live data
  );
}

/**
 * Get top pages by sessions.
 */
export async function getTopPages(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {},
  limit = 10
): Promise<TopPage[]> {
  const params = new URLSearchParams();
  if (options.range) params.set("range", options.range);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);
  params.set("limit", String(limit));
  const query = params.toString();
  const cacheKey = `op:pages:${config.projectId}:${query}`;
  return fetchOP<TopPage[]>(config, `/insights/${config.projectId}/pages?${query}`, cacheKey);
}

/**
 * Get referrer data.
 */
export async function getReferrers(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {},
  limit = 10
): Promise<ReferrerItem[]> {
  const params = new URLSearchParams();
  if (options.range) params.set("range", options.range);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);
  params.set("limit", String(limit));
  const query = params.toString();
  const cacheKey = `op:referrers:${config.projectId}:${query}`;
  return fetchOP<ReferrerItem[]>(
    config,
    `/insights/${config.projectId}/referrer?${query}`,
    cacheKey
  );
}

/**
 * Get country breakdown.
 */
export async function getCountries(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {},
  limit = 10
): Promise<CountryItem[]> {
  const params = new URLSearchParams();
  if (options.range) params.set("range", options.range);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);
  params.set("limit", String(limit));
  const query = params.toString();
  const cacheKey = `op:countries:${config.projectId}:${query}`;
  return fetchOP<CountryItem[]>(config, `/insights/${config.projectId}/country?${query}`, cacheKey);
}

// ---------------------------------------------------------------------------
// New endpoints (Round 8 — Analytics Intelligence)
// ---------------------------------------------------------------------------

export interface UTMSourceItem {
  name: string | null;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

export interface UTMCampaignItem {
  name: string | null;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

export interface UTMTermItem {
  name: string | null;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

export interface DeviceItem {
  name: string;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

export interface BrowserItem {
  name: string;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

function buildQuery(
  options: { range?: string; startDate?: string; endDate?: string },
  limit = 25
): string {
  const params = new URLSearchParams();
  if (options.range) params.set("range", options.range);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);
  params.set("limit", String(limit));
  return params.toString();
}

/**
 * Get top pages with engagement data (extended limit).
 */
export async function getDetailedPages(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {},
  limit = 50
): Promise<TopPage[]> {
  const query = buildQuery(options, limit);
  const cacheKey = `op:detailed-pages:${config.projectId}:${query}`;
  return fetchOP<TopPage[]>(config, `/insights/${config.projectId}/pages?${query}`, cacheKey);
}

/**
 * Get UTM campaign data (sources, campaigns, terms).
 */
export async function getCampaignData(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {}
): Promise<{ sources: UTMSourceItem[]; campaigns: UTMCampaignItem[]; terms: UTMTermItem[] }> {
  const query = buildQuery(options);
  const [sources, campaigns, terms] = await Promise.all([
    fetchOP<UTMSourceItem[]>(
      config,
      `/insights/${config.projectId}/utm_source?${query}`,
      `op:utm-source:${config.projectId}:${query}`
    ),
    fetchOP<UTMCampaignItem[]>(
      config,
      `/insights/${config.projectId}/utm_campaign?${query}`,
      `op:utm-campaign:${config.projectId}:${query}`
    ),
    fetchOP<UTMTermItem[]>(
      config,
      `/insights/${config.projectId}/utm_term?${query}`,
      `op:utm-term:${config.projectId}:${query}`
    ),
  ]);
  return { sources, campaigns, terms };
}

/**
 * Get device + browser breakdown.
 */
export async function getDeviceBreakdown(
  config: OpenPanelConfig,
  options: { range?: string; startDate?: string; endDate?: string } = {}
): Promise<{ devices: DeviceItem[]; browsers: BrowserItem[]; countries: CountryItem[] }> {
  const query = buildQuery(options);
  const [devices, browsers, countries] = await Promise.all([
    fetchOP<DeviceItem[]>(
      config,
      `/insights/${config.projectId}/device?${query}`,
      `op:devices:${config.projectId}:${query}`
    ),
    fetchOP<BrowserItem[]>(
      config,
      `/insights/${config.projectId}/browser?${query}`,
      `op:browsers:${config.projectId}:${query}`
    ),
    fetchOP<CountryItem[]>(
      config,
      `/insights/${config.projectId}/country?${query}`,
      `op:countries-bd:${config.projectId}:${query}`
    ),
  ]);
  return { devices, browsers, countries };
}

/**
 * Resolve OpenPanel project metadata needed for dashboard deep-links.
 */
export async function getManagedProject(config: OpenPanelConfig): Promise<ManagedProject> {
  const cacheKey = `op:manage-project:${config.projectId}`;
  const data = await fetchOP<{ data: ManagedProject }>(
    config,
    `/manage/projects/${config.projectId}`,
    cacheKey,
    MANAGE_CACHE_TTL_MS
  );
  return data.data;
}

export async function listManagedProjects(
  clientId: string,
  clientSecret: string
): Promise<ManagedProjectListItem[]> {
  const cacheKey = `op:manage-projects:${clientId}`;
  const cached = getCached<ManagedProjectListItem[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${BASE_URL}/manage/projects`, {
    headers: {
      "openpanel-client-id": clientId,
      "openpanel-client-secret": clientSecret,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new OpenPanelAPIError(
      response.status,
      `OpenPanel API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const payload = (await response.json()) as unknown;
  const rawProjects =
    payload && typeof payload === "object" && "data" in payload && Array.isArray(payload.data)
      ? (payload.data as unknown[])
      : Array.isArray(payload)
        ? payload
        : [];

  const projects = rawProjects
    .map((project) => {
      if (!project || typeof project !== "object") return null;

      const id =
        typeof project.id === "string"
          ? project.id
          : typeof project.projectId === "string"
            ? project.projectId
            : null;
      if (!id || id.trim().length === 0) return null;

      const name =
        typeof project.name === "string" && project.name.trim().length > 0
          ? project.name.trim()
          : null;
      const organizationId =
        typeof project.organizationId === "string" && project.organizationId.trim().length > 0
          ? project.organizationId.trim()
          : null;

      return {
        id: id.trim(),
        name,
        organizationId,
      };
    })
    .filter((project): project is ManagedProjectListItem => project !== null)
    .sort((left, right) => {
      const leftLabel = left.name ?? left.id;
      const rightLabel = right.name ?? right.id;
      return leftLabel.localeCompare(rightLabel);
    });

  setCache(cacheKey, projects, MANAGE_CACHE_TTL_MS);
  return projects;
}
