/* biome-ignore-all lint/style/useNamingConvention: OAuth/GWS payload fields use provider-defined snake_case keys. */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";

const execAsync = promisify(exec);

interface GWSCredentials {
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
}

export async function handleGwsImport() {
  try {
    let raw: string;
    try {
      const { stdout } = await execAsync("gws auth export", { timeout: 10000 });
      raw = stdout;
    } catch {
      return errorJson(
        500,
        "gws CLI not found or not authenticated. Run: gws auth login -s https://www.googleapis.com/auth/webmasters.readonly",
        { imported: false }
      );
    }

    let parsed: GWSCredentials;
    try {
      parsed = JSON.parse(raw) as GWSCredentials;
    } catch {
      return errorJson(500, "Failed to parse gws auth export output", { imported: false });
    }

    if (!parsed.refresh_token) {
      return errorJson(
        400,
        "No refresh_token in gws credentials. Run: gws auth login -s https://www.googleapis.com/auth/webmasters.readonly",
        { imported: false }
      );
    }

    const repo = getCredentialRepo();
    const credKey = "google-search-console";
    const existing = (await repo.getCredential(credKey)) ?? {};

    const merged = {
      ...existing,
      clientId: parsed.client_id ?? existing.clientId ?? "",
      clientSecret: parsed.client_secret ?? existing.clientSecret ?? "",
      refreshToken: parsed.refresh_token,
    };

    await repo.setCredential(credKey, merged);

    return NextResponse.json({ imported: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorJson(500, message, { imported: false });
  }
}
