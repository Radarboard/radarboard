import type { CredentialRepository, SupabaseConfig } from "@radarboard/types/database";
import { decrypt, encrypt } from "@radarboard/utils/crypto";

export class SupabaseCredentialRepository implements CredentialRepository {
  private url: string;
  private headers: Record<string, string>;
  private encryptionKey: string;

  constructor(config: SupabaseConfig, encryptionKey: string) {
    this.url = `${config.url}/rest/v1`;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    this.encryptionKey = encryptionKey;
  }

  async getCredential(key: string): Promise<Record<string, string> | null> {
    const res = await fetch(
      `${this.url}/widget_credentials?key=eq.${encodeURIComponent(key)}&select=encrypted_data`,
      { headers: this.headers }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ encrypted_data: string }>;
    const row = rows[0];
    if (!row) return null;
    try {
      return JSON.parse(decrypt(row.encrypted_data, this.encryptionKey)) as Record<string, string>;
    } catch {
      return null;
    }
  }

  async setCredential(key: string, values: Record<string, string>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const encrypted = encrypt(JSON.stringify(values), this.encryptionKey);
    await fetch(`${this.url}/widget_credentials`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, encrypted_data: encrypted, updated_at: now }),
    });
  }

  async deleteCredential(key: string): Promise<void> {
    await fetch(`${this.url}/widget_credentials?key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  async listCredentialKeys(): Promise<string[]> {
    const res = await fetch(`${this.url}/widget_credentials?select=key`, {
      headers: this.headers,
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ key: string }>;
    return rows.map((r) => r.key);
  }
}
