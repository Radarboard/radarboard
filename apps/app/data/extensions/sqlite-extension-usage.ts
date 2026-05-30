import { sql } from "drizzle-orm";
import { ensureDbReady, getDb } from "@/data/core/client";
import { extensionUsage } from "@/data/core/schema";

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await ensureDbReady();
  const db = getDb();
  await db.run(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS extension_usage (
      extension_id TEXT NOT NULL,
      extension_type TEXT NOT NULL,
      day TEXT NOT NULL,
      mount_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      total_render_ms INTEGER NOT NULL DEFAULT 0,
      UNIQUE(extension_id, extension_type, day)
    )
  `)
  );
  await db.run(
    sql.raw("CREATE INDEX IF NOT EXISTS extension_usage_day_idx ON extension_usage(day)")
  );
  tableReady = true;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Increment the mount count for an extension. Called on component mount.
 * @public
 */
export async function trackExtensionMount(
  extensionId: string,
  extensionType: "integration" | "plugin" | "widget"
): Promise<void> {
  await ensureTable();
  const db = getDb();
  const day = today();

  await db
    .insert(extensionUsage)
    .values({ extensionId, extensionType, day, mountCount: 1 })
    .onConflictDoUpdate({
      target: [extensionUsage.extensionId, extensionUsage.extensionType, extensionUsage.day],
      set: { mountCount: sql`mount_count + 1` },
    });
}

/**
 * Increment the error count for an extension. Called on error boundary catch.
 * @public
 */
export async function trackExtensionError(
  extensionId: string,
  extensionType: "integration" | "plugin" | "widget"
): Promise<void> {
  await ensureTable();
  const db = getDb();
  const day = today();

  await db
    .insert(extensionUsage)
    .values({ extensionId, extensionType, day, errorCount: 1 })
    .onConflictDoUpdate({
      target: [extensionUsage.extensionId, extensionUsage.extensionType, extensionUsage.day],
      set: { errorCount: sql`error_count + 1` },
    });
}

export interface ExtensionUsageSummary {
  extensionId: string;
  extensionType: string;
  totalMounts: number;
  totalErrors: number;
  lastActiveDay: string;
}

/** Get usage summary for all extensions. */
export async function getExtensionUsageSummary(): Promise<ExtensionUsageSummary[]> {
  await ensureTable();
  const db = getDb();

  const rows = await db.all<{
    extension_id: string;
    extension_type: string;
    total_mounts: number;
    total_errors: number;
    last_active: string;
  }>(
    sql.raw(`
    SELECT
      extension_id,
      extension_type,
      SUM(mount_count) as total_mounts,
      SUM(error_count) as total_errors,
      MAX(day) as last_active
    FROM extension_usage
    GROUP BY extension_id, extension_type
    ORDER BY total_mounts DESC
  `)
  );

  return rows.map((row) => ({
    extensionId: row.extension_id,
    extensionType: row.extension_type,
    totalMounts: row.total_mounts,
    totalErrors: row.total_errors,
    lastActiveDay: row.last_active,
  }));
}
