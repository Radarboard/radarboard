import { createClient } from "@libsql/client";
import type { CacheEntry, CacheRepository, TursoConfig } from "@radarboard/types/database";

/**
 * Turso-backed cache repository. Uses the same libsql protocol as SQLite
 * but connects to a remote Turso database for cross-device sync.
 */
export class TursoCacheRepository implements CacheRepository {
  private client: ReturnType<typeof createClient>;

  constructor(config: TursoConfig) {
    this.client = createClient({ url: config.url, authToken: config.authToken });
  }

  async get(key: string): Promise<CacheEntry | null> {
    const result = await this.client.execute({
      sql: "SELECT key, data, fetched_at, ttl_seconds FROM api_cache WHERE key = ?",
      args: [key],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      key: row.key as string,
      data: row.data as string,
      fetchedAt: row.fetched_at as number,
      ttlSeconds: row.ttl_seconds as number,
    };
  }

  async set(entry: CacheEntry & { route: string }): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO api_cache (key, route, data, fetched_at, ttl_seconds)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET data = ?, fetched_at = ?, ttl_seconds = ?`,
      args: [
        entry.key,
        entry.route,
        entry.data,
        entry.fetchedAt,
        entry.ttlSeconds,
        entry.data,
        entry.fetchedAt,
        entry.ttlSeconds,
      ],
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.execute({ sql: "DELETE FROM api_cache WHERE key = ?", args: [key] });
  }

  async clear(): Promise<void> {
    await this.client.execute("DELETE FROM api_cache");
  }

  async getKeysByRoute(route: string): Promise<string[]> {
    const result = await this.client.execute({
      sql: "SELECT key FROM api_cache WHERE route = ?",
      args: [route],
    });
    return result.rows.map((r) => r.key as string);
  }

  async deleteExpired(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.client.execute({
      sql: "DELETE FROM api_cache WHERE fetched_at + ttl_seconds < ?",
      args: [now],
    });
    return result.rowsAffected;
  }

  async listEntries(
    _limit?: number
  ): Promise<(import("@radarboard/types/database").CacheEntry & { route: string })[]> {
    return [];
  }
}
