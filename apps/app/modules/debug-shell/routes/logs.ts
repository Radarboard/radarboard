import { logBuffer } from "@radarboard/logger/log-buffer";
import type { LogLevel } from "@radarboard/types/logs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSearchParams } from "@/lib/api";

const logsQuerySchema = z.object({
  level: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  after: z.string().optional(),
  limit: z.string().optional(),
});

/**
 * GET /api/logs — returns structured log entries from the in-memory ring buffer.
 */
export function handleGetLogs(request: Request): NextResponse {
  const parsed = parseSearchParams(new URL(request.url).searchParams, logsQuerySchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const level = parsed.data.level as LogLevel | undefined;
  const source = parsed.data.source;
  const search = parsed.data.search;
  const after = parsed.data.after;
  const limit = parsed.data.limit;

  const result = logBuffer.getEntries({
    level: level ?? undefined,
    source: source ?? undefined,
    search: search ?? undefined,
    after: after ? Number(after) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return NextResponse.json(result);
}

/**
 * DELETE /api/logs — clears the in-memory log buffer.
 */
export function handleClearLogs(): NextResponse {
  logBuffer.clear();
  return NextResponse.json({ cleared: true });
}
