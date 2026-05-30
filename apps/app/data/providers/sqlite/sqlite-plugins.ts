import type { PluginRepository } from "@radarboard/types/database";
import { and, eq, like, sql } from "drizzle-orm";
import { getDb } from "@/data/core/client";
import { pluginData } from "@/data/core/schema";

const PLUGIN_DDL = [
  `CREATE TABLE IF NOT EXISTS plugin_data (
    plugin_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (plugin_id, key)
  )`,
];

export class SqlitePluginRepository implements PluginRepository {
  private initialized = false;

  private async ensureTables(): Promise<void> {
    if (this.initialized) return;
    const db = getDb();
    for (const ddl of PLUGIN_DDL) {
      await db.run(sql.raw(ddl));
    }
    this.initialized = true;
  }

  async get(pluginId: string, key: string): Promise<string | null> {
    await this.ensureTables();
    const db = getDb();
    const row = await db
      .select()
      .from(pluginData)
      .where(and(eq(pluginData.pluginId, pluginId), eq(pluginData.key, key)))
      .get();
    return row?.value ?? null;
  }

  async set(pluginId: string, key: string, value: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(pluginData)
      .values({ pluginId, key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: [pluginData.pluginId, pluginData.key],
        set: { value, updatedAt: now },
      });
  }

  async delete(pluginId: string, key: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .delete(pluginData)
      .where(and(eq(pluginData.pluginId, pluginId), eq(pluginData.key, key)));
  }

  async list(pluginId: string, prefix: string): Promise<{ key: string; value: string }[]> {
    await this.ensureTables();
    const db = getDb();
    const rows = await db
      .select({ key: pluginData.key, value: pluginData.value })
      .from(pluginData)
      .where(and(eq(pluginData.pluginId, pluginId), like(pluginData.key, `${prefix}%`)))
      .all();
    return rows;
  }
}
