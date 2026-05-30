import type { CacheEntry, CacheRepository } from "@radarboard/types/database";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/data/core/client";
import { apiCache } from "@/data/core/schema";

export class SqliteCacheRepository implements CacheRepository {
  async get(key: string): Promise<CacheEntry | null> {
    const db = getDb();
    const row = await db.select().from(apiCache).where(eq(apiCache.key, key)).get();
    if (!row) return null;

    return {
      key: row.key,
      data: row.data,
      fetchedAt: row.fetchedAt,
      ttlSeconds: row.ttlSeconds,
    };
  }

  async set(entry: CacheEntry & { route: string }): Promise<void> {
    const db = getDb();
    await db
      .insert(apiCache)
      .values({
        key: entry.key,
        route: entry.route,
        data: entry.data,
        fetchedAt: entry.fetchedAt,
        ttlSeconds: entry.ttlSeconds,
      })
      .onConflictDoUpdate({
        target: apiCache.key,
        set: {
          data: entry.data,
          fetchedAt: entry.fetchedAt,
          ttlSeconds: entry.ttlSeconds,
        },
      });
  }

  async delete(key: string): Promise<void> {
    const db = getDb();
    await db.delete(apiCache).where(eq(apiCache.key, key));
  }

  async clear(): Promise<void> {
    const db = getDb();
    await db.delete(apiCache);
  }

  async getKeysByRoute(route: string): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ key: apiCache.key })
      .from(apiCache)
      .where(eq(apiCache.route, route));
    return rows.map((r) => r.key);
  }

  async deleteExpired(): Promise<number> {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const expired = await db
      .select({ key: apiCache.key })
      .from(apiCache)
      .where(sql`${apiCache.fetchedAt} + ${apiCache.ttlSeconds} < ${now}`);
    if (expired.length === 0) return 0;
    await db.delete(apiCache).where(sql`${apiCache.fetchedAt} + ${apiCache.ttlSeconds} < ${now}`);
    return expired.length;
  }

  async listEntries(limit = 200): Promise<(CacheEntry & { route: string })[]> {
    const db = getDb();
    const rows = await db.select().from(apiCache).orderBy(apiCache.fetchedAt).limit(limit);
    return rows.map((r) => ({
      key: r.key,
      route: r.route,
      data: r.data,
      fetchedAt: r.fetchedAt,
      ttlSeconds: r.ttlSeconds,
    }));
  }
}
