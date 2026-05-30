import { createClient } from "@libsql/client";
import type { CredentialRepository, TursoConfig } from "@radarboard/types/database";
import { decrypt, encrypt } from "@radarboard/utils/crypto";

export class TursoCredentialRepository implements CredentialRepository {
  private client: ReturnType<typeof createClient>;
  private encryptionKey: string;

  constructor(config: TursoConfig, encryptionKey: string) {
    this.client = createClient({ url: config.url, authToken: config.authToken });
    this.encryptionKey = encryptionKey;
  }

  async getCredential(key: string): Promise<Record<string, string> | null> {
    const result = await this.client.execute({
      sql: "SELECT encrypted_data FROM widget_credentials WHERE key = ?",
      args: [key],
    });
    const row = result.rows[0];
    if (!row?.encrypted_data) return null;
    try {
      return JSON.parse(decrypt(row.encrypted_data as string, this.encryptionKey)) as Record<
        string,
        string
      >;
    } catch {
      return null;
    }
  }

  async setCredential(key: string, values: Record<string, string>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const encrypted = encrypt(JSON.stringify(values), this.encryptionKey);
    await this.client.execute({
      sql: `INSERT INTO widget_credentials (key, encrypted_data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET encrypted_data = ?, updated_at = ?`,
      args: [key, encrypted, now, encrypted, now],
    });
  }

  async deleteCredential(key: string): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM widget_credentials WHERE key = ?",
      args: [key],
    });
  }

  async listCredentialKeys(): Promise<string[]> {
    const result = await this.client.execute("SELECT key FROM widget_credentials");
    return result.rows.map((r) => r.key as string);
  }
}
