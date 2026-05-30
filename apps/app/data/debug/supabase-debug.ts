import type {
  DebugEventQuery,
  DebugEventRow,
  DebugRepository,
  SupabaseConfig,
} from "@radarboard/types/database";

export class SupabaseDebugRepository implements DebugRepository {
  private url: string;
  private headers: Record<string, string>;

  constructor(config: SupabaseConfig) {
    this.url = `${config.url}/rest/v1`;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
    };
  }

  async insertEvent(event: DebugEventRow): Promise<void> {
    await fetch(`${this.url}/debug_events`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        id: event.id,
        occurred_at: event.occurredAt,
        ingested_at: event.ingestedAt,
        level: event.level,
        source: event.source,
        event_type: event.eventType,
        message: event.message,
        project_slug: event.projectSlug,
        trace_id: event.traceId,
        request_id: event.requestId,
        session_id: event.sessionId,
        conversation_id: event.conversationId,
        entity_type: event.entityType,
        entity_id: event.entityId,
        status: event.status,
        duration_ms: event.durationMs,
        metadata: event.metadata,
      }),
    });
  }

  async listEvents(query: DebugEventQuery = {}): Promise<DebugEventRow[]> {
    const url = new URL(`${this.url}/debug_events`);
    url.searchParams.set(
      "select",
      "id,occurred_at,ingested_at,level,source,event_type,message,project_slug,trace_id,request_id,session_id,conversation_id,entity_type,entity_id,status,duration_ms,metadata"
    );
    url.searchParams.set("order", "occurred_at.desc");
    url.searchParams.set("limit", String(query.limit ?? 200));

    if (query.level) url.searchParams.set("level", `eq.${query.level}`);
    if (query.source) url.searchParams.set("source", `like.${query.source}%`);
    if (query.eventType) url.searchParams.set("event_type", `eq.${query.eventType}`);
    if (query.projectSlug) url.searchParams.set("project_slug", `eq.${query.projectSlug}`);
    if (query.traceId) url.searchParams.set("trace_id", `eq.${query.traceId}`);
    if (query.requestId) url.searchParams.set("request_id", `eq.${query.requestId}`);
    if (query.conversationId) url.searchParams.set("conversation_id", `eq.${query.conversationId}`);
    if (query.entityType) url.searchParams.set("entity_type", `eq.${query.entityType}`);
    if (query.entityId) url.searchParams.set("entity_id", `eq.${query.entityId}`);
    if (query.after) url.searchParams.set("occurred_at", `gte.${query.after}`);
    if (query.before) url.searchParams.append("occurred_at", `lte.${query.before}`);
    if (query.search) {
      const encoded = `*${query.search}*`;
      url.searchParams.set(
        "or",
        `(message.ilike.${encoded},source.ilike.${encoded},event_type.ilike.${encoded})`
      );
    }

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToDebugEvent);
  }

  async pruneEvents(olderThan: string): Promise<number> {
    const countUrl = new URL(`${this.url}/debug_events`);
    countUrl.searchParams.set("select", "id");
    countUrl.searchParams.set("occurred_at", `lt.${olderThan}`);
    const countRes = await fetch(countUrl.toString(), { headers: this.headers });
    if (!countRes.ok) return 0;
    const rows = (await countRes.json()) as Array<Record<string, unknown>>;
    if (rows.length === 0) return 0;

    await fetch(`${this.url}/debug_events?occurred_at=lt.${encodeURIComponent(olderThan)}`, {
      method: "DELETE",
      headers: this.headers,
    });
    return rows.length;
  }
}

function rowToDebugEvent(row: Record<string, unknown>): DebugEventRow {
  return {
    id: row.id as string,
    occurredAt: row.occurred_at as string,
    ingestedAt: row.ingested_at as string,
    level: row.level as DebugEventRow["level"],
    source: row.source as string,
    eventType: row.event_type as string,
    message: row.message as string,
    projectSlug: (row.project_slug as string | null) ?? null,
    traceId: (row.trace_id as string | null) ?? null,
    requestId: (row.request_id as string | null) ?? null,
    sessionId: (row.session_id as string | null) ?? null,
    conversationId: (row.conversation_id as string | null) ?? null,
    entityType: (row.entity_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    durationMs: (row.duration_ms as number | null) ?? null,
    metadata: (row.metadata as string) ?? "{}",
  };
}
