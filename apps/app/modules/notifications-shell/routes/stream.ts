/* biome-ignore-all lint/style/useNamingConvention: SSE response headers intentionally use protocol casing. */
import { createLogger } from "@radarboard/logger/logger";
import { notificationStreamHub } from "@radarboard/notifications/stream-hub";

const log = createLogger("api/notifications/stream");

export function handleNotificationStream(): Response {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      try {
        unsubscribe = notificationStreamHub.subscribe((message) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
          } catch {
            // stream closed; cleanup happens in cancel
          }
        });
      } catch (err) {
        log.error("Failed to subscribe to notification stream", { error: err });
        controller.error(err);
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // stream closed; cleanup happens in cancel
        }
      }, 30_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
