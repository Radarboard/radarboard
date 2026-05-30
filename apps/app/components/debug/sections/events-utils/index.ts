"use client";

export type EventLevel = "debug" | "info" | "warn" | "error";

export interface DebugEvent {
  id: string;
  occurredAt: string;
  ingestedAt: string;
  level: EventLevel;
  source: string;
  eventType: string;
  message: string;
  projectSlug: string | null;
  traceId: string | null;
  requestId: string | null;
  sessionId: string | null;
  conversationId: string | null;
  entityType: string | null;
  entityId: string | null;
  status: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  promoted?: boolean;
  notificationStatuses?: string[];
}

export interface EventListRow {
  key: string;
  event: DebugEvent;
  count: number;
  fingerprint: string | null;
  relatedIds: string[];
}

export function getEventFingerprint(event: DebugEvent): string | null {
  const value = event.metadata?.fingerprint;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function buildEventListRows(events: DebugEvent[], grouped: boolean): EventListRow[] {
  if (!grouped) {
    return events.map((event) => ({
      key: event.id,
      event,
      count: 1,
      fingerprint: getEventFingerprint(event),
      relatedIds: [event.id],
    }));
  }

  const rows: EventListRow[] = [];
  const rowIndexByKey = new Map<string, number>();

  for (const event of events) {
    const fingerprint = getEventFingerprint(event);
    const key = fingerprint ?? event.id;
    const existingIndex = rowIndexByKey.get(key);
    if (existingIndex == null) {
      rowIndexByKey.set(key, rows.length);
      rows.push({
        key,
        event,
        count: 1,
        fingerprint,
        relatedIds: [event.id],
      });
    } else {
      const current = rows[existingIndex];
      if (!current) continue;
      current.count += 1;
      current.relatedIds.push(event.id);
    }
  }

  return rows;
}

export function durationBadgeVariant(durationMs: number): "muted" | "accent" | "warning" | "error" {
  if (durationMs >= 10_000) return "error";
  if (durationMs >= 3_000) return "warning";
  if (durationMs >= 1_000) return "accent";
  return "muted";
}
