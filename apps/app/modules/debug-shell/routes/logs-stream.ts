/* biome-ignore-all lint/style/useNamingConvention: SSE response headers intentionally use protocol casing. */
import { logBuffer } from "@radarboard/logger/log-buffer";
import { createLogger } from "@radarboard/logger/logger";

const log = createLogger("api/logs/stream");

/**
 * GET /api/logs/stream — SSE endpoint that streams new log entries in real-time.
 */
export function handleLogsStream(): Response {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      try {
        unsubscribe = logBuffer.subscribe((entry) => {
          try {
            const data = JSON.stringify(entry);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            // Stream closed, will be cleaned up in cancel()
          }
        });
      } catch (err) {
        log.error("Failed to subscribe to log buffer", { error: err });
        controller.error(err);
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Stream closed
        }
      }, 30_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) {
        clearInterval(heartbeat);
      }
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
