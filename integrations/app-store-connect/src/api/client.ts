/**
 * App Store Connect API client for the Radarboard dashboard.
 *
 * Uses the REST API at https://api.appstoreconnect.apple.com/v1/
 * Authenticated via JWT (ES256) using App Store Connect API keys.
 *
 * Rate limit: 200 requests per minute.
 * All responses are cached server-side for 15 minutes.
 *
 * @see https://developer.apple.com/documentation/appstoreconnectapi
 */

import { createSign } from "node:crypto";

import type {
  AppInfo,
  AppStoreVersion,
  ASCConfig,
  CustomerReview,
  CustomerReviewSummarization,
} from "../types";

const BASE_URL = "https://api.appstoreconnect.apple.com/v1";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

// --- JWT Authentication ---

let jwtToken: string | null = null;
let jwtExpiresAt = 0;

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n").trim();
}

function createJWT(config: ASCConfig): string {
  if (jwtToken && Date.now() < jwtExpiresAt) {
    return jwtToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 20 * 60; // 20 minutes

  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" })
  ).toString("base64url");

  const payload = Buffer.from(
    JSON.stringify({
      iss: config.issuerId,
      iat: now,
      exp,
      aud: "appstoreconnect-v1",
    })
  ).toString("base64url");

  const sign = createSign("SHA256");
  sign.update(`${header}.${payload}`);
  sign.end();

  // JWT ES256 signatures use raw r||s bytes, not ASN.1 DER encoding.
  const signature = sign
    .sign({
      key: normalizePrivateKey(config.privateKey),
      dsaEncoding: "ieee-p1363",
    })
    .toString("base64url");

  jwtToken = `${header}.${payload}.${signature}`;
  jwtExpiresAt = (exp - 60) * 1000; // Refresh 60s before expiry

  return jwtToken;
}

// --- API Client ---

export class ASCAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "ASCAPIError";
  }
}

async function fetchASC<T>(
  config: ASCConfig,
  path: string,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const token = createJWT(config);
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new ASCAPIError(
      response.status,
      `App Store Connect API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}

// --- Public API ---

/**
 * Get app information.
 *
 * Cache TTL: 15 minutes
 */
export async function getAppInfo(config: ASCConfig, appId: string): Promise<AppInfo> {
  const cacheKey = `asc:app:${appId}`;
  const data = await fetchASC<{ data: AppInfo }>(config, `/apps/${appId}`, cacheKey);
  return data.data;
}

/**
 * Get customer reviews for an app.
 *
 * Cache TTL: 15 minutes
 */
export async function getCustomerReviews(
  config: ASCConfig,
  appId: string,
  options?: {
    limit?: number;
  }
): Promise<CustomerReview[]> {
  const limit = options?.limit ?? 20;

  const params = new URLSearchParams({
    limit: String(limit),
  });

  const cacheKey = `asc:reviews:${appId}:${params.toString()}`;
  const data = await fetchASC<{ data: CustomerReview[] }>(
    config,
    `/apps/${appId}/customerReviews?${params.toString()}`,
    cacheKey
  );
  return data.data;
}

/**
 * Get customer review summarizations for an app.
 *
 * Cache TTL: 15 minutes
 */
export async function getCustomerReviewSummarizations(
  config: ASCConfig,
  appId: string,
  options: {
    platform: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
    territory?: string;
    limit?: number;
  }
): Promise<CustomerReviewSummarization[]> {
  const params = new URLSearchParams({
    "filter[platform]": options.platform,
    limit: String(options.limit ?? 1),
  });
  if (options.territory) {
    params.set("filter[territory]", options.territory);
  }

  const cacheKey = `asc:review-summaries:${appId}:${params.toString()}`;
  const data = await fetchASC<{ data: CustomerReviewSummarization[] }>(
    config,
    `/apps/${appId}/customerReviewSummarizations?${params.toString()}`,
    cacheKey
  );
  return data.data;
}

/**
 * Get app versions (version history).
 *
 * Cache TTL: 15 minutes
 */
export async function getAppVersions(
  config: ASCConfig,
  appId: string,
  options?: {
    limit?: number;
    platform?: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
  }
): Promise<AppStoreVersion[]> {
  const limit = options?.limit ?? 10;
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "-createdDate",
  });
  if (options?.platform) {
    params.set("filter[platform]", options.platform);
  }

  const cacheKey = `asc:versions:${appId}:${params.toString()}`;
  const data = await fetchASC<{ data: AppStoreVersion[] }>(
    config,
    `/apps/${appId}/appStoreVersions?${params.toString()}`,
    cacheKey
  );
  return data.data;
}
