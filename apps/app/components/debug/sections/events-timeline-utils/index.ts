export type TimelineEventLevel = "debug" | "info" | "warn" | "error";

export interface TimelineEvent {
  occurredAt: string;
  level: TimelineEventLevel;
}

export interface TimelineBucket {
  index: number;
  startMs: number;
  endMs: number;
  count: number;
  errorCount: number;
  warnCount: number;
}

export function buildTimelineBuckets(
  events: TimelineEvent[],
  bucketCount: number
): TimelineBucket[] {
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
  })) satisfies TimelineBucket[];

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

export function isQuickRangeActive(
  fromMs: number | null,
  toMs: number | null,
  rangeEndMs: number | null,
  presetMs: number
): boolean {
  if (fromMs == null || toMs == null || rangeEndMs == null) return false;
  const expectedFrom = rangeEndMs - presetMs;
  return Math.abs(toMs - rangeEndMs) < 60_000 && Math.abs(fromMs - expectedFrom) < 60_000;
}

export function formatClock(ms: number | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
