/**
 * Server-side SSE event gateway.
 *
 * Manages connected SSE clients and broadcasts events to them.
 * Events are typed and clients can subscribe to specific channels.
 *
 * Channels:
 * - "notifications" — webhook and delta detector events
 * - "invalidation" — widget data refresh signals
 * - "intents" — plugin-to-plugin communication
 * - "health" — integration health status changes
 */

export type EventChannel = "notifications" | "invalidation" | "intents" | "health";

export interface GatewayEvent {
  channel: EventChannel;
  type: string;
  data: unknown;
  timestamp: number;
}

interface ConnectedClient {
  id: string;
  controller: ReadableStreamDefaultController;
  channels: Set<EventChannel>;
  connectedAt: number;
}

const GLOBAL_KEY = "__radarboard_event_gateway__" as const;

function getClients(): Map<string, ConnectedClient> {
  const g = globalThis as unknown as Record<string, Map<string, ConnectedClient>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

const encoder = new TextEncoder();

function formatSSE(event: GatewayEvent): Uint8Array {
  const data = JSON.stringify({
    channel: event.channel,
    type: event.type,
    data: event.data,
    timestamp: event.timestamp,
  });
  return encoder.encode(`data: ${data}\n\n`);
}

/** Register a new SSE client connection. */
export function addClient(
  id: string,
  controller: ReadableStreamDefaultController,
  channels: EventChannel[] = ["notifications", "invalidation", "intents", "health"]
): void {
  getClients().set(id, {
    id,
    controller,
    channels: new Set(channels),
    connectedAt: Date.now(),
  });
}

/** Remove a disconnected client. */
export function removeClient(id: string): void {
  getClients().delete(id);
}

/** Broadcast an event to all clients subscribed to the event's channel. */
export function broadcast(event: GatewayEvent): void {
  const clients = getClients();
  const message = formatSSE(event);

  for (const [id, client] of clients) {
    if (!client.channels.has(event.channel)) continue;
    try {
      client.controller.enqueue(message);
    } catch {
      // Client disconnected — clean up
      clients.delete(id);
    }
  }
}

/** Get the number of connected clients. */
export function getClientCount(): number {
  return getClients().size;
}

/**
 * Emit a cache invalidation event. Connected SSE clients will receive this
 * and can trigger SWR revalidation for matching cache key prefixes.
 */
export function emitCacheInvalidation(prefixes: string[], source?: string): void {
  broadcast({
    channel: "invalidation",
    type: "cache:invalidate",
    data: { prefixes, source },
    timestamp: Date.now(),
  });
}

/** Emit a typed event to all subscribers. Convenience wrapper around broadcast. */
export function emit(channel: EventChannel, type: string, data: unknown): void {
  broadcast({
    channel,
    type,
    data,
    timestamp: Date.now(),
  });
}
