import type { CacheEntry, CacheRepository, PlanetscaleConfig } from "@radarboard/types/database";

/**
 * PlanetScale-backed cache repository. Uses PlanetScale's serverless
 * HTTP API (no additional dependencies required beyond fetch).
 *
 * Requires table:
 * - api_cache (cache_key varchar(512) PK, route varchar(255), data longtext, fetched_at bigint, ttl_seconds int)
 *
 * Note: PlanetScale column is named `cache_key` instead of `key` because
 * `key` is a reserved word in MySQL.
 */
export class PlanetscaleCacheRepository implements CacheRepository {
  private config: PlanetscaleConfig;

  constructor(config: PlanetscaleConfig) {
    this.config = config;
  }

  private async query(
    sql: string,
    args: unknown[] = []
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const res = await fetch(`https://${this.config.host}/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, args }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PlanetScale query failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { rows?: Record<string, unknown>[] };
    return { rows: data.rows ?? [] };
  }

  async get(key: string): Promise<CacheEntry | null> {
    const result = await this.query(
      "SELECT cache_key, data, fetched_at, ttl_seconds FROM api_cache WHERE cache_key = ?",
      [key]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      key: row.cache_key as string,
      data: row.data as string,
      fetchedAt: Number(row.fetched_at),
      ttlSeconds: Number(row.ttl_seconds),
    };
  }

  async set(entry: CacheEntry & { route: string }): Promise<void> {
    await this.query(
      `INSERT INTO api_cache (cache_key, route, data, fetched_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), fetched_at = VALUES(fetched_at), ttl_seconds = VALUES(ttl_seconds)`,
      [entry.key, entry.route, entry.data, entry.fetchedAt, entry.ttlSeconds]
    );
  }

  async delete(key: string): Promise<void> {
    await this.query("DELETE FROM api_cache WHERE cache_key = ?", [key]);
  }

  async clear(): Promise<void> {
    await this.query("DELETE FROM api_cache");
  }

  async getKeysByRoute(route: string): Promise<string[]> {
    const result = await this.query("SELECT cache_key FROM api_cache WHERE route = ?", [route]);
    return result.rows.map((r) => r.cache_key as string);
  }

  async deleteExpired(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const countResult = await this.query(
      "SELECT COUNT(*) AS cnt FROM api_cache WHERE fetched_at + ttl_seconds < ?",
      [now]
    );
    const count = Number(countResult.rows[0]?.cnt ?? 0);
    if (count === 0) return 0;
    await this.query("DELETE FROM api_cache WHERE fetched_at + ttl_seconds < ?", [now]);
    return count;
  }

  async listEntries(
    _limit?: number
  ): Promise<(import("@radarboard/types/database").CacheEntry & { route: string })[]> {
    return [];
  }
}
