import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson } from "@/lib/api";
import { queryDebugEvents } from "@/lib/debug-events";

const levelSchema = z.enum(["debug", "info", "warn", "error"]);

const querySchema = z.object({
  level: levelSchema.optional(),
  source: z.string().optional(),
  eventType: z.string().optional(),
  projectSlug: z.string().optional(),
  traceId: z.string().optional(),
  requestId: z.string().optional(),
  conversationId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  search: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.coerce.number().int().min(100).max(5000).optional(),
  buckets: z.coerce.number().int().min(10).max(120).optional(),
});

function buildTimelineBuckets(
  events: Array<{ occurredAt: string; level: "debug" | "info" | "warn" | "error" }>,
  bucketCount: number
) {
  if (events.length === 0) return [];

  const timestamps = events
    .map((event) => Date.parse(event.occurredAt))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const minMs = timestamps[0] ?? Date.now();
  const maxMs = timestamps[timestamps.length - 1] ?? minMs;
  const span = Math.max(1, maxMs - minMs);
  const bucketWidth = span / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    startMs: minMs + bucketWidth * index,
    endMs: index === bucketCount - 1 ? maxMs : minMs + bucketWidth * (index + 1),
    count: 0,
    errorCount: 0,
    warnCount: 0,
  }));

  for (const event of events) {
    const timestamp = Date.parse(event.occurredAt);
    if (!Number.isFinite(timestamp)) continue;
    const rawIndex = Math.floor(((timestamp - minMs) / span) * bucketCount);
    const index = Math.max(0, Math.min(bucketCount - 1, rawIndex));
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.count += 1;
    if (event.level === "error") bucket.errorCount += 1;
    else if (event.level === "warn") bucket.warnCount += 1;
  }

  return buckets;
}

export async function handleDebugEventsTimeline(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return errorJson(400, "Invalid query parameters");
    }

    const limit = parsed.data.limit ?? 2000;
    const bucketCount = parsed.data.buckets ?? 60;
    const events = await queryDebugEvents({ ...parsed.data, limit });
    const buckets = buildTimelineBuckets(events, bucketCount);

    return NextResponse.json({
      buckets,
      totalEvents: events.length,
      rangeStart: buckets[0]?.startMs ?? null,
      rangeEnd: buckets[buckets.length - 1]?.endMs ?? null,
    });
  } catch (err) {
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
