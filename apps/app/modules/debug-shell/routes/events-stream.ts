/* biome-ignore-all lint/style/useNamingConvention: SSE response headers intentionally use protocol casing. */
import { createLogger } from "@radarboard/logger/logger";
import { z } from "zod";
import { parseSearchParams } from "@/lib/api";
import { addClient, type EventChannel, removeClient } from "@/lib/event-gateway";

const log = createLogger("api/events/stream");

const VALID_CHANNELS = new Set<EventChannel>([
  "notifications",
  "invalidation",
  "intents",
  "health",
]);

const EventStreamSearchSchema = z.object({
  channels: z.string().optional(),
});

/**
 * GET /api/events/stream — SSE endpoint for real-time event streaming.
 */
export async function handleEventsStream(request: Request) {
  const parsedSearch = parseSearchParams(
    new URL(request.url).searchParams,
    EventStreamSearchSchema
  );
  if (!parsedSearch.ok) {
    return parsedSearch.response;
  }

  const { channels: channelsParam } = parsedSearch.data;

  const channels: EventChannel[] = channelsParam
    ? (channelsParam
        .split(",")
        .filter((c) => VALID_CHANNELS.has(c as EventChannel)) as EventChannel[])
    : [...VALID_CHANNELS];

  if (channels.length === 0) {
    return new Response("No valid channels specified", { status: 400 });
  }

  const clientId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      addClient(clientId, controller, channels);
      log.info("SSE client connected", { clientId, channels });

      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", clientId, channels })}\n\n`)
      );
    },
    cancel() {
      removeClient(clientId);
      log.info("SSE client disconnected", { clientId });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Client-Id": clientId,
    },
  });
}
