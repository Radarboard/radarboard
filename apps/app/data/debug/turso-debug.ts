import { createClient } from "@libsql/client";
import type {
  DebugEventQuery,
  DebugEventRow,
  DebugRepository,
  TursoConfig,
} from "@radarboard/types/database";

export class TursoDebugRepository implements DebugRepository {
  private client: ReturnType<typeof createClient>;

  constructor(config: TursoConfig) {
    this.client = createClient({ url: config.url, authToken: config.authToken });
  }

  async insertEvent(event: DebugEventRow): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO debug_events (
              id, occurred_at, ingested_at, level, source, event_type, message,
              project_slug, trace_id, request_id, session_id, conversation_id,
              entity_type, entity_id, status, duration_ms, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        event.id,
        event.occurredAt,
        event.ingestedAt,
        event.level,
        event.source,
        event.eventType,
        event.message,
        event.projectSlug,
        event.traceId,
        event.requestId,
        event.sessionId,
        event.conversationId,
        event.entityType,
        event.entityId,
        event.status,
        event.durationMs,
        event.metadata,
      ],
    });
  }

  async listEvents(query: DebugEventQuery = {}): Promise<DebugEventRow[]> {
    const where: string[] = [];
    const args: Array<string | number | null> = [];

    addEq(where, args, "level", query.level);
    if (query.source) {
      where.push("source LIKE ?");
      args.push(`${query.source}%`);
    }
    addEq(where, args, "event_type", query.eventType);
    addEq(where, args, "project_slug", query.projectSlug);
    addEq(where, args, "trace_id", query.traceId);
    addEq(where, args, "request_id", query.requestId);
    addEq(where, args, "conversation_id", query.conversationId);
    addEq(where, args, "entity_type", query.entityType);
    addEq(where, args, "entity_id", query.entityId);
    if (query.after) {
      where.push("occurred_at >= ?");
      args.push(query.after);
    }
    if (query.before) {
      where.push("occurred_at <= ?");
      args.push(query.before);
    }
    if (query.search) {
      where.push("(message LIKE ? OR source LIKE ? OR event_type LIKE ?)");
      const pattern = `%${query.search}%`;
      args.push(pattern, pattern, pattern);
    }

    const result = await this.client.execute({
      sql: `SELECT
              id, occurred_at, ingested_at, level, source, event_type, message,
              project_slug, trace_id, request_id, session_id, conversation_id,
              entity_type, entity_id, status, duration_ms, metadata
            FROM debug_events
            ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
            ORDER BY occurred_at DESC
            LIMIT ?`,
      args: [...args, query.limit ?? 200],
    });

    return result.rows.map(rowToDebugEvent);
  }

  async pruneEvents(olderThan: string): Promise<number> {
    const countResult = await this.client.execute({
      sql: "SELECT id FROM debug_events WHERE occurred_at < ?",
      args: [olderThan],
    });
    const count = countResult.rows.length;
    if (count === 0) return 0;

    await this.client.execute({
      sql: "DELETE FROM debug_events WHERE occurred_at < ?",
      args: [olderThan],
    });
    return count;
  }

  async clearAll(): Promise<void> {
    await this.client.execute({ sql: "DELETE FROM debug_events", args: [] });
  }
}

function addEq(
  where: string[],
  args: Array<string | number | null>,
  column: string,
  value: string | undefined
) {
  if (!value) return;
  where.push(`${column} = ?`);
  args.push(value);
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
