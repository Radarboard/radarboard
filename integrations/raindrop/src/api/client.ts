import type {
  RaindropCollectionsResponse,
  RaindropConfig,
  RaindropItemsResponse,
  RaindropTagsResponse,
} from "../types";

const BASE_URL = "https://api.raindrop.io/rest/v1";
const CACHE_TTL_MS = 120 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

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

export function evictCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export class RaindropAPIError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "RaindropAPIError";
  }
}

async function fetchRaindrop<T>(
  config: RaindropConfig,
  path: string,
  cacheKey: string,
  ttlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new RaindropAPIError(
      response.status,
      `Raindrop API error ${response.status}${body ? `: ${body}` : ""}`
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, ttlMs);
  return data;
}

interface ListRaindropsOptions {
  collectionId?: number;
  search?: string;
  sort?: string;
  page?: number;
  perpage?: number;
  nested?: boolean;
}

function buildRaindropQuery(options: ListRaindropsOptions): string {
  const params = new URLSearchParams();
  if (options.sort) params.set("sort", options.sort);
  if (options.search) params.set("search", options.search);
  if (typeof options.page === "number") params.set("page", String(options.page));
  if (typeof options.perpage === "number") params.set("perpage", String(options.perpage));
  if (typeof options.nested === "boolean") params.set("nested", String(options.nested));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function getRecentRaindrops(
  config: RaindropConfig,
  options: ListRaindropsOptions = {}
): Promise<RaindropItemsResponse> {
  const collectionId = options.collectionId ?? 0;
  const query = buildRaindropQuery({
    sort: options.sort ?? "-created",
    search: options.search,
    page: options.page ?? 0,
    perpage: options.perpage ?? 25,
    nested: options.nested ?? true,
  });
  const cacheKey = `raindrop:raindrops:${collectionId}:${query || "default"}`;
  return fetchRaindrop<RaindropItemsResponse>(
    config,
    `/raindrops/${collectionId}${query}`,
    cacheKey
  );
}

export async function getCollections(config: RaindropConfig): Promise<RaindropCollectionsResponse> {
  return fetchRaindrop<RaindropCollectionsResponse>(config, "/collections", "raindrop:collections");
}

export async function getTags(
  config: RaindropConfig,
  collectionId = 0
): Promise<RaindropTagsResponse> {
  return fetchRaindrop<RaindropTagsResponse>(
    config,
    `/tags/${collectionId}`,
    `raindrop:tags:${collectionId}`
  );
}
