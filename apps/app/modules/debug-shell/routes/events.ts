import { NextResponse } from "next/server";
import { z } from "zod";
import { getNotificationRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { emitDebugEvent, queryDebugEvents } from "@/lib/debug-events";

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
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const bodySchema = z.object({
  level: levelSchema,
  source: z.string().min(1),
  eventType: z.string().min(1),
  message: z.string().min(1),
  projectSlug: z.string().nullable().optional(),
  traceId: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().optional(),
});

function extractDebugEventIds(metadata: Record<string, unknown>): string[] {
  const direct = typeof metadata.debugEventId === "string" ? [metadata.debugEventId] : [];
  const many = Array.isArray(metadata.debugEventIds)
    ? metadata.debugEventIds.filter((id): id is string => typeof id === "string")
    : [];
  return [...direct, ...many];
}

export async function handleListDebugEvents(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return errorJson(400, "Invalid query parameters");
    }

    const limit = parsed.data.limit ?? 200;
    const queriedEvents = await queryDebugEvents({ ...parsed.data, limit: limit + 1 });
    const notificationRepo = getNotificationRepo();
    const promotionMap = new Map<string, string[]>();

    if (notificationRepo) {
      const feed = await notificationRepo.getFeed({
        limit: 500,
        status: "all",
        includeDismissed: true,
        source: parsed.data.source,
        projectSlug: parsed.data.projectSlug,
      });

      for (const item of feed.items) {
        const ids = extractDebugEventIds(item.metadata);
        for (const id of ids) {
          const statuses = promotionMap.get(id) ?? [];
          statuses.push(item.status);
          promotionMap.set(id, statuses);
        }
      }
    }

    const hasMore = queriedEvents.length > limit;
    const visibleEvents = hasMore ? queriedEvents.slice(0, limit) : queriedEvents;

    const annotatedEvents = visibleEvents.map((event) => {
      const statuses = promotionMap.get(event.id) ?? [];
      return {
        ...event,
        promoted: statuses.length > 0,
        notificationStatuses: statuses,
      };
    });

    return NextResponse.json({
      events: annotatedEvents,
      nextBefore: hasMore
        ? (annotatedEvents[annotatedEvents.length - 1]?.occurredAt ?? null)
        : null,
    });
  } catch (err) {
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}

export async function handleCreateDebugEvent(request: Request) {
  try {
    const raw = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return errorJson(400, "Invalid event payload");
    }

    const id = await emitDebugEvent(parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
