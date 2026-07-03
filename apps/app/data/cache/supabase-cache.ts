import type { CacheEntry, CacheRepository, SupabaseConfig } from "@radarboard/types/database";

/**
 * Supabase-backed cache repository. Uses Supabase's PostgREST API
 * (no additional dependencies required beyond fetch).
 *
 * Requires these tables in Supabase:
 * - api_cache (key text PK, route text, data text, fetched_at int8, ttl_seconds int4)
 */
export class SupabaseCacheRepository implements CacheRepository {
  private url: string;
  private headers: Record<string, string>;

  constructor(config: SupabaseConfig) {
    this.url = `${config.url}/rest/v1`;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
  }

  async get(key: string): Promise<CacheEntry | null> {
    const res = await fetch(`${this.url}/api_cache?key=eq.${encodeURIComponent(key)}&select=*`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      key: string;
      data: string;
      fetched_at: number;
      ttl_seconds: number;
    }>;
    const row = rows[0];
    if (!row) return null;
    return {
      key: row.key,
      data: row.data,
      fetchedAt: row.fetched_at,
      ttlSeconds: row.ttl_seconds,
    };
  }

  async set(entry: CacheEntry & { route: string }): Promise<void> {
    const body = {
      key: entry.key,
      route: entry.route,
      data: entry.data,
      fetched_at: entry.fetchedAt,
      ttl_seconds: entry.ttlSeconds,
    };

    await fetch(`${this.url}/api_cache`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
  }

  async delete(key: string): Promise<void> {
    await fetch(`${this.url}/api_cache?key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  async clear(): Promise<void> {
    // PostgREST requires a filter for DELETE, use neq to match all
    await fetch(`${this.url}/api_cache?key=neq.___impossible___`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  async getKeysByRoute(route: string): Promise<string[]> {
    const res = await fetch(
      `${this.url}/api_cache?route=eq.${encodeURIComponent(route)}&select=key`,
      { headers: this.headers }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ key: string }>;
    return rows.map((r) => r.key);
  }

  async deleteExpired(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    // PostgREST cannot do column arithmetic in filters, so fetch all
    // entries and filter client-side. The cache table is small (~50-100 rows).
    const res = await fetch(`${this.url}/api_cache?select=key,fetched_at,ttl_seconds`, {
      headers: this.headers,
    });
    if (!res.ok) return 0;
    const rows = (await res.json()) as Array<{
      key: string;
      fetched_at: number;
      ttl_seconds: number;
    }>;
    const expired = rows.filter((r) => r.fetched_at + r.ttl_seconds < now);
    if (expired.length === 0) return 0;
    // Delete concurrently instead of one serial round-trip at a time.
    await Promise.all(expired.map((row) => this.delete(row.key)));
    return expired.length;
  }

  async listEntries(
    _limit?: number
  ): Promise<(import("@radarboard/types/database").CacheEntry & { route: string })[]> {
    return [];
  }
}
