import { createClient } from "@libsql/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { getEncryptionKey, getTursoConfig } from "@/lib/env";

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client) {
    client = createClient(getTursoConfig());
  }
  return client;
}

export async function ensureStorage() {
  await getClient().execute(`
    CREATE TABLE IF NOT EXISTS widget_credentials (
      key TEXT PRIMARY KEY,
      encrypted_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

export async function getRecord(key: string): Promise<Record<string, string> | null> {
  await ensureStorage();
  const result = await getClient().execute({
    sql: "SELECT encrypted_data FROM widget_credentials WHERE key = ?",
    args: [key],
  });
  const encrypted = result.rows[0]?.encrypted_data;
  if (!encrypted || typeof encrypted !== "string") return null;

  try {
    return JSON.parse(decrypt(encrypted, getEncryptionKey())) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function setRecord(key: string, values: Record<string, string>) {
  await ensureStorage();
  const now = Math.floor(Date.now() / 1000);
  const encrypted = encrypt(JSON.stringify(values), getEncryptionKey());

  await getClient().execute({
    sql: `INSERT INTO widget_credentials (key, encrypted_data, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET encrypted_data = ?, updated_at = ?`,
    args: [key, encrypted, now, encrypted, now],
  });
}

export async function deleteRecord(key: string) {
  await ensureStorage();
  await getClient().execute({
    sql: "DELETE FROM widget_credentials WHERE key = ?",
    args: [key],
  });
}
