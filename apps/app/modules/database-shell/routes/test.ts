import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/database/test");

const databaseTestSchema = z.object({
  provider: z.enum(["sqlite", "supabase", "turso", "planetscale"]),
  config: z.record(z.string(), z.string().optional()).default({}),
});

async function testSupabase(config: Record<string, string | undefined>): Promise<NextResponse> {
  const url = config?.url;
  const anonKey = config?.anonKey;

  if (!url || !anonKey) {
    return errorJson(400, "Missing url or anonKey", { success: false });
  }

  const response = await fetch(`${url}/rest/v1/?apikey=${anonKey}`, {
    method: "HEAD",
    headers: { apikey: anonKey },
  });

  if (!response.ok) {
    return errorJson(500, `Supabase responded with status ${response.status}`, { success: false });
  }

  return NextResponse.json({ success: true });
}

async function testTurso(config: Record<string, string | undefined>): Promise<NextResponse> {
  const url = config?.url;
  const authToken = config?.authToken;

  if (!url || !authToken) {
    return errorJson(400, "Missing url or authToken", { success: false });
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({ url, authToken });
  await client.execute("SELECT 1");

  return NextResponse.json({ success: true });
}

async function testPlanetscale(config: Record<string, string | undefined>): Promise<NextResponse> {
  const host = config?.host;
  const username = config?.username;
  const password = config?.password;

  if (!host || !username || !password) {
    return errorJson(400, "Missing host, username, or password", { success: false });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(`https://${host}/v1/query`, {
    method: "POST",
    headers: {
      // biome-ignore lint/style/useNamingConvention: standard HTTP header casing
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "SELECT 1" }),
  });

  if (!response.ok) {
    return errorJson(500, `PlanetScale responded with status ${response.status}`, {
      success: false,
    });
  }

  return NextResponse.json({ success: true });
}

export async function handleTestDatabase(request: Request) {
  try {
    const parsed = await parseBody(request, databaseTestSchema);
    if (!parsed.ok) return parsed.response;
    const { provider, config } = parsed.data;

    switch (provider) {
      case "sqlite":
        return NextResponse.json({ success: true });
      case "supabase":
        return await testSupabase(config);
      case "turso":
        return await testTurso(config);
      case "planetscale":
        return await testPlanetscale(config);
      default:
        return errorJson(400, "Unknown provider", { success: false });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Database connection test failed", { error });
    return errorJson(500, message, { success: false });
  }
}
