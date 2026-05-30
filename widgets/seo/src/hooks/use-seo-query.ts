"use client";

/**
 * SEO Query — SWR hook (co-located copy from @radarboard/hooks)
 */

import type { SeoQueryDetail } from "@radarboard/types/seo";
import useSWR from "swr";
import { ROUTES } from "../routes";

interface SeoQueryResponse {
  configured: boolean;
  detail?: SeoQueryDetail;
  error?: string;
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function buildUrl(base: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) searchParams.set(key, value);
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Fetch per-query detail data for the SEO modal.
 *
 * Only fires when both query and siteUrl are non-null (i.e. a row is selected).
 *
 * Caching strategy (three layers):
 *  1. SWR in-memory cache — data shows instantly on second open within the same session.
 *  2. dedupingInterval (1 h) — prevents background re-fetches while the DB cache is still
 *     valid, avoiding unnecessary round-trips when the modal is closed and reopened.
 *  3. DB cache via withCache (1 h TTL server-side) — survives page refreshes; no GSC API
 *     call is made as long as the DB entry is fresh.
 */
export function useSeoQuery(query: string | null, siteUrl: string | null) {
  const key = query && siteUrl ? buildUrl(ROUTES.seoQuery, { query, siteUrl }) : null;

  const { data, error, isLoading } = useSWR<SeoQueryResponse>(key, apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    // Matches the server-side DB cache TTL — prevents SWR from background-revalidating
    // on every modal reopen within the same hour.
    dedupingInterval: 3600_000,
  });

  return {
    detail: data?.detail ?? null,
    configured: data?.configured ?? false,
    loading: isLoading,
    error: error?.message ?? data?.error ?? null,
  };
}
