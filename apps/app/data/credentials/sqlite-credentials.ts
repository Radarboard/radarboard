import type { CredentialRepository } from "@radarboard/types/database";
import { decrypt, encrypt } from "@radarboard/utils/crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/data/core/client";
import { widgetCredentials } from "@/data/core/schema";

export class SqliteCredentialRepository implements CredentialRepository {
  private encryptionKey: string;
  private initialized = false;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    const db = getDb();
    await db.run(
      sql`CREATE TABLE IF NOT EXISTS widget_credentials (
        key TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    );
    this.initialized = true;
  }

  async getCredential(key: string): Promise<Record<string, string> | null> {
    await this.ensureTable();
    const db = getDb();
    const row = await db
      .select()
      .from(widgetCredentials)
      .where(eq(widgetCredentials.key, key))
      .get();

    if (!row) return null;

    try {
      const decrypted = decrypt(row.encryptedData, this.encryptionKey);
      return JSON.parse(decrypted) as Record<string, string>;
    } catch {
      return null;
    }
  }

  async setCredential(key: string, values: Record<string, string>): Promise<void> {
    await this.ensureTable();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const encrypted = encrypt(JSON.stringify(values), this.encryptionKey);

    await db
      .insert(widgetCredentials)
      .values({ key, encryptedData: encrypted, updatedAt: now })
      .onConflictDoUpdate({
        target: widgetCredentials.key,
        set: { encryptedData: encrypted, updatedAt: now },
      });
  }

  async deleteCredential(key: string): Promise<void> {
    await this.ensureTable();
    const db = getDb();
    await db.delete(widgetCredentials).where(eq(widgetCredentials.key, key));
  }

  async listCredentialKeys(): Promise<string[]> {
    await this.ensureTable();
    const db = getDb();
    const rows = await db.select({ key: widgetCredentials.key }).from(widgetCredentials).all();
    return rows.map((r) => r.key);
  }
}
