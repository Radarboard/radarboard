/**
 * Vercel REST API client for the Radarboard dashboard.
 *
 * Uses the REST API at https://api.vercel.com
 * Authenticated via Bearer token.
 *
 * Rate limit: 500 requests per minute.
 * All responses are cached server-side for 2 minutes.
 *
 * @see https://vercel.com/docs/rest-api
 */

import type { VercelConfig, VercelDeployment, VercelDomain, VercelProject } from "../types";

const BASE_URL = "https://api.vercel.com";

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

export class VercelAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "VercelAPIError";
  }
}

// --- Fetcher ---

async function fetchVercel<T>(
  config: VercelConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams();
  if (config.teamId) params.set("teamId", config.teamId);
  const separator = path.includes("?") ? "&" : "?";
  const teamQuery = config.teamId ? `${separator}${params.toString()}` : "";

  const url = `${BASE_URL}${path}${teamQuery}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new VercelAPIError(
      response.status,
      `Vercel API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * Get recent deployments, optionally filtered by project.
 *
 * Cache TTL: 2 minutes
 */
export async function getRecentDeployments(
  config: VercelConfig,
  options?: {
    projectId?: string;
    target?: "production" | "staging";
    limit?: number;
  }
): Promise<VercelDeployment[]> {
  const limit = options?.limit ?? 20;
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.projectId) params.set("projectId", options.projectId);
  if (options?.target) params.set("target", options.target);

  const cacheKey = `vercel:deployments:${params.toString()}`;
  const data = await fetchVercel<{ deployments: VercelDeployment[] }>(
    config,
    `/v6/deployments?${params.toString()}`,
    cacheKey
  );
  return data.deployments;
}

/**
 * Get project details including latest deployments.
 *
 * Cache TTL: 2 minutes
 */
export async function getProject(config: VercelConfig, projectId: string): Promise<VercelProject> {
  const cacheKey = `vercel:project:${projectId}`;
  return fetchVercel<VercelProject>(config, `/v9/projects/${projectId}`, cacheKey);
}

/**
 * List all projects in the team/account.
 *
 * Cache TTL: 5 minutes (project list rarely changes)
 */
export async function listProjects(
  config: VercelConfig,
  options?: { limit?: number }
): Promise<VercelProject[]> {
  const limit = options?.limit ?? 100;
  const cacheKey = `vercel:projects:list:${limit}`;
  const data = await fetchVercel<{ projects: VercelProject[] }>(
    config,
    `/v9/projects?limit=${limit}`,
    cacheKey,
    5 * 60 * 1000
  );
  return data.projects;
}

/**
 * Get domains for a project.
 *
 * Cache TTL: 5 minutes (domains rarely change)
 */
export async function getProjectDomains(
  config: VercelConfig,
  projectId: string
): Promise<VercelDomain[]> {
  const cacheKey = `vercel:domains:${projectId}`;
  const data = await fetchVercel<{ domains: VercelDomain[] }>(
    config,
    `/v9/projects/${projectId}/domains`,
    cacheKey,
    5 * 60 * 1000
  );
  return data.domains;
}
