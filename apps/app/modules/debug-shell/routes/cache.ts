import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCacheRepo } from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";

const log = createLogger("api/debug/cache");

const cacheQuerySchema = z.object({
  limit: z.string().optional(),
});

export async function handleListDebugCacheEntries(request: Request) {
  try {
    const parsed = parseSearchParams(new URL(request.url).searchParams, cacheQuerySchema);
    if (!parsed.ok) return parsed.response;
    const limit = Math.min(Number(parsed.data.limit ?? "200"), 500);
    const repo = getCacheRepo();
    const entries = await repo.listEntries(limit);
    return NextResponse.json({ entries });
  } catch (err) {
    log.error("Failed to list debug cache entries", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
