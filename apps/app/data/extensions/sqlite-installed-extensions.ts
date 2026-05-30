import { eq, sql } from "drizzle-orm";
import { ensureDbReady, getDb } from "@/data/core/client";
import { installedExtensions } from "@/data/core/schema";

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await ensureDbReady();
  const db = getDb();
  await db.run(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS installed_extensions (
      id TEXT PRIMARY KEY,
      github_url TEXT NOT NULL,
      commit_sha TEXT,
      extension_types TEXT NOT NULL,
      installed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  );
  tableReady = true;
}

export interface InstalledExtensionRecord {
  id: string;
  githubUrl: string;
  commitSha: string | null;
  extensionTypes: string[];
  installedAt: number;
  updatedAt: number;
}

export async function upsertInstalledExtension(record: InstalledExtensionRecord): Promise<void> {
  await ensureTable();
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  await db
    .insert(installedExtensions)
    .values({
      id: record.id,
      githubUrl: record.githubUrl,
      commitSha: record.commitSha,
      extensionTypes: JSON.stringify(record.extensionTypes),
      installedAt: record.installedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: installedExtensions.id,
      set: {
        githubUrl: record.githubUrl,
        commitSha: record.commitSha,
        extensionTypes: JSON.stringify(record.extensionTypes),
        updatedAt: now,
      },
    });
}

export async function getAllInstalledExtensions(): Promise<InstalledExtensionRecord[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db.select().from(installedExtensions);
  return rows.map((row) => ({
    id: row.id,
    githubUrl: row.githubUrl,
    commitSha: row.commitSha,
    extensionTypes: JSON.parse(row.extensionTypes) as string[],
    installedAt: row.installedAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Get a single installed extension by ID.
 * @public
 */
export async function getInstalledExtension(id: string): Promise<InstalledExtensionRecord | null> {
  await ensureTable();
  const db = getDb();
  const [row] = await db.select().from(installedExtensions).where(eq(installedExtensions.id, id));
  if (!row) return null;
  return {
    id: row.id,
    githubUrl: row.githubUrl,
    commitSha: row.commitSha,
    extensionTypes: JSON.parse(row.extensionTypes) as string[],
    installedAt: row.installedAt,
    updatedAt: row.updatedAt,
  };
}
