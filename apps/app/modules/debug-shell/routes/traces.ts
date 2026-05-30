import { buildTraceInsight as coreBuildTraceInsight } from "@radarboard/assistant-core/trace-insights";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { errorJson, parseBody, parseSearchParams } from "@/lib/api";
import { emitDebugEvent, queryDebugEvents } from "@/lib/debug-events";

const log = createLogger("api/debug/traces");
const tracesQuerySchema = z.object({
  limit: z.string().optional(),
});
const traceRatingSchema = z.object({
  id: z.string().min(1),
  rating: z.number().nullable(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function handleListDebugTraces(request: Request) {
  try {
    const parsed = parseSearchParams(new URL(request.url).searchParams, tracesQuerySchema);
    if (!parsed.ok) return parsed.response;
    const limit = Math.min(Number(parsed.data.limit ?? "200"), 500);
    const repo = getLlmRepo();
    const traces = await repo.listTraces(limit);
    const earliestCreatedAt = traces[traces.length - 1]?.createdAt;
    const relatedEvents =
      traces.length > 0
        ? await queryDebugEvents({
            after: earliestCreatedAt,
            limit: Math.min(Math.max(limit * 20, 200), 4_000),
          })
        : [];

    return NextResponse.json({ traces: coreBuildTraceInsight(traces, relatedEvents) });
  } catch (err) {
    log.error("Failed to list traces", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}

export async function handleUpdateTraceRating(request: Request) {
  try {
    const parsed = await parseBody(request, traceRatingSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const repo = getLlmRepo();
    await repo.updateTraceRating(body.id, body.rating);
    const relatedEvents = await queryDebugEvents({ traceId: body.id, limit: 20 }).catch(() => []);
    const contextRecord = relatedEvents.map((event) => event.metadata?.context).find(isRecord);
    const evidenceRecord = relatedEvents.map((event) => event.metadata?.evidence).find(isRecord);
    const relatedConversation = relatedEvents.find((event) => event.conversationId)?.conversationId;
    const relatedProject = relatedEvents.find((event) => event.projectSlug)?.projectSlug;

    await emitDebugEvent({
      level: "info",
      source: "api/debug/traces",
      eventType: "chat.feedback.recorded",
      message: (() => {
        if (body.rating === 1) return "Positive trace feedback recorded";
        if (body.rating === -1) return "Negative trace feedback recorded";
        return "Trace feedback cleared";
      })(),
      projectSlug: relatedProject ?? null,
      traceId: body.id,
      conversationId: relatedConversation ?? null,
      entityType: "trace",
      entityId: body.id,
      status: "completed",
      metadata: {
        rating: body.rating,
        context: contextRecord ?? undefined,
        evidence: evidenceRecord ?? undefined,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Failed to update trace rating", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
