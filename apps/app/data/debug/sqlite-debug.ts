import type { DebugEventQuery, DebugEventRow, DebugRepository } from "@radarboard/types/database";
import { and, desc, eq, gte, like, lte, or, type SQL, sql } from "drizzle-orm";
import { getDb } from "@/data/core/client";
import { debugEvents } from "@/data/core/schema";

const DEBUG_DDL = [
  `CREATE TABLE IF NOT EXISTS debug_events (
    id TEXT PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    level TEXT NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    project_slug TEXT,
    trace_id TEXT,
    request_id TEXT,
    session_id TEXT,
    conversation_id TEXT,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT,
    duration_ms INTEGER,
    metadata TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS debug_events_occurred_idx ON debug_events(occurred_at)`,
  `CREATE INDEX IF NOT EXISTS debug_events_project_idx ON debug_events(project_slug, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS debug_events_source_idx ON debug_events(source, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS debug_events_type_idx ON debug_events(event_type, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS debug_events_trace_idx ON debug_events(trace_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS debug_events_conv_idx ON debug_events(conversation_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS debug_events_entity_idx ON debug_events(entity_type, entity_id, occurred_at)`,
];

export class SqliteDebugRepository implements DebugRepository {
  private initialized = false;

  private async ensureTables(): Promise<void> {
    if (this.initialized) return;
    const db = getDb();
    for (const ddl of DEBUG_DDL) {
      await db.run(sql.raw(ddl));
    }
    this.initialized = true;
  }

  async insertEvent(event: DebugEventRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.insert(debugEvents).values(event);
  }

  async listEvents(query: DebugEventQuery = {}): Promise<DebugEventRow[]> {
    await this.ensureTables();
    const db = getDb();
    const filters: SQL[] = [];

    if (query.level) filters.push(eq(debugEvents.level, query.level));
    if (query.source) filters.push(like(debugEvents.source, `${query.source}%`));
    if (query.eventType) filters.push(eq(debugEvents.eventType, query.eventType));
    if (query.projectSlug) filters.push(eq(debugEvents.projectSlug, query.projectSlug));
    if (query.traceId) filters.push(eq(debugEvents.traceId, query.traceId));
    if (query.requestId) filters.push(eq(debugEvents.requestId, query.requestId));
    if (query.conversationId) filters.push(eq(debugEvents.conversationId, query.conversationId));
    if (query.entityType) filters.push(eq(debugEvents.entityType, query.entityType));
    if (query.entityId) filters.push(eq(debugEvents.entityId, query.entityId));
    if (query.after) filters.push(gte(debugEvents.occurredAt, query.after));
    if (query.before) filters.push(lte(debugEvents.occurredAt, query.before));
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(
        or(
          like(debugEvents.message, pattern),
          like(debugEvents.source, pattern),
          like(debugEvents.eventType, pattern)
        )!
      );
    }

    const rows = await db
      .select()
      .from(debugEvents)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(debugEvents.occurredAt))
      .limit(query.limit ?? 200);

    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      ingestedAt: row.ingestedAt,
      level: row.level as DebugEventRow["level"],
      source: row.source,
      eventType: row.eventType,
      message: row.message,
      projectSlug: row.projectSlug ?? null,
      traceId: row.traceId ?? null,
      requestId: row.requestId ?? null,
      sessionId: row.sessionId ?? null,
      conversationId: row.conversationId ?? null,
      entityType: row.entityType ?? null,
      entityId: row.entityId ?? null,
      status: row.status ?? null,
      durationMs: row.durationMs ?? null,
      metadata: row.metadata,
    }));
  }

  async pruneEvents(olderThan: string): Promise<number> {
    await this.ensureTables();
    const db = getDb();
    const rows = await db
      .select({ id: debugEvents.id })
      .from(debugEvents)
      .where(sql`${debugEvents.occurredAt} < ${olderThan}`);

    if (rows.length === 0) return 0;

    await db.delete(debugEvents).where(sql`${debugEvents.occurredAt} < ${olderThan}`);
    return rows.length;
  }
}
