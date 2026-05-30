import type { CredentialRepository, PlanetscaleConfig } from "@radarboard/types/database";
import { decrypt, encrypt } from "@radarboard/utils/crypto";

export class PlanetscaleCredentialRepository implements CredentialRepository {
  private config: PlanetscaleConfig;
  private encryptionKey: string;

  constructor(config: PlanetscaleConfig, encryptionKey: string) {
    this.config = config;
    this.encryptionKey = encryptionKey;
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

  async getCredential(key: string): Promise<Record<string, string> | null> {
    const result = await this.query(
      "SELECT encrypted_data FROM widget_credentials WHERE `key` = ?",
      [key]
    );
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
    await this.query(
      `INSERT INTO widget_credentials (\`key\`, encrypted_data, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE encrypted_data = VALUES(encrypted_data), updated_at = VALUES(updated_at)`,
      [key, encrypted, now]
    );
  }

  async deleteCredential(key: string): Promise<void> {
    await this.query("DELETE FROM widget_credentials WHERE `key` = ?", [key]);
  }

  async listCredentialKeys(): Promise<string[]> {
    const result = await this.query("SELECT `key` FROM widget_credentials");
    return result.rows.map((r) => r.key as string);
  }
}
