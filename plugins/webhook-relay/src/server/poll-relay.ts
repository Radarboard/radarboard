interface RelayIntegrationEvent {
  source: string;
  sourceEventId?: string | null;
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  projectSlug?: string | null;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: number;
}

interface RelayEvent {
  id: string;
  integration: string;
  event: RelayIntegrationEvent;
  receivedAt: number;
}

export interface RelayPollResult {
  eventCount: number;
  relayTimestamp: number;
}

export interface PollWebhookRelayDependencies {
  getRelayUrl: () => Promise<string | undefined>;
  getRelaySecret: () => string | undefined;
  persistIntegrationArtifacts: (events: RelayIntegrationEvent[]) => Promise<void>;
  emitNotificationEvents: (events: RelayIntegrationEvent[]) => void;
  emitDebugEvent: (input: {
    level: "error" | "warn" | "info";
    source: string;
    eventType: string;
    message: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }) => Promise<unknown>;
}

export async function pollWebhookRelay(
  sinceMs: number,
  deps: PollWebhookRelayDependencies
): Promise<RelayPollResult | null> {
  const url = await deps.getRelayUrl();
  const secret = deps.getRelaySecret();

  if (!url || !secret) return null;

  const res = await fetch(`${url}/api/events?since=${sinceMs}&limit=100`, {
    headers: { authorization: `Bearer ${secret}` },
  });

  if (!res.ok) return null;

  const relayTimestamp = res.headers.get("x-relay-timestamp");
  const events: RelayEvent[] = await res.json();

  if (events.length > 0) {
    const integrationEvents = events.map((relayEvent) => relayEvent.event);
    await deps.persistIntegrationArtifacts(integrationEvents);
    deps.emitNotificationEvents(integrationEvents);

    for (const relayEvent of events) {
      deps
        .emitDebugEvent({
          level:
            relayEvent.event.severity === "critical"
              ? "error"
              : relayEvent.event.severity === "warning"
                ? "warn"
                : "info",
          source: `relay/${relayEvent.integration}`,
          eventType: relayEvent.event.type,
          message: relayEvent.event.title,
          entityType: "webhook",
          entityId: relayEvent.id,
          metadata: {
            integration: relayEvent.integration,
            severity: relayEvent.event.severity,
            body: relayEvent.event.body,
            receivedAt: relayEvent.receivedAt,
            sourceEventId: relayEvent.event.sourceEventId,
            ...relayEvent.event.metadata,
          },
          occurredAt: new Date(relayEvent.receivedAt).toISOString(),
        })
        .catch(() => {
          // Best-effort debug emission should not break relay polling.
        });
    }
  }

  return {
    eventCount: events.length,
    relayTimestamp: relayTimestamp ? Number(relayTimestamp) : Date.now(),
  };
}
