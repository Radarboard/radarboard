import type { NotificationRepository } from "@radarboard/types/database";
import type {
  NewNotificationDelivery,
  NewNotificationDigest,
  NewNotificationEvent,
  NotificationEventQuery,
  NotificationEventRow,
  NotificationFeedItem,
  NotificationFeedQuery,
  NotificationPreferenceRow,
  NotificationRuleRow,
  NotificationSeverity,
  NotificationSnoozeRow,
  PaginatedResult,
  WebhookEndpointRow,
} from "@radarboard/types/notifications";
import { and, desc, eq, inArray, lt, type SQL, sql } from "drizzle-orm";
import { getDb } from "@/data/core/client";
import {
  notificationDeliveries,
  notificationDigests,
  notificationEvents,
  notificationPreferences,
  notificationRules,
  notificationSnoozes,
  webhookEndpoints,
} from "@/data/core/schema";

const NOTIFICATION_DDL = [
  `CREATE TABLE IF NOT EXISTS notification_events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_event_id TEXT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    project_slug TEXT,
    title TEXT NOT NULL,
    body TEXT,
    metadata TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    ingested_at INTEGER NOT NULL,
    batch_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS notification_events_source_type_idx ON notification_events(source, type)`,
  `CREATE INDEX IF NOT EXISTS notification_events_severity_idx ON notification_events(severity)`,
  `CREATE INDEX IF NOT EXISTS notification_events_project_idx ON notification_events(project_slug)`,
  `CREATE INDEX IF NOT EXISTS notification_events_occurred_idx ON notification_events(occurred_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notification_events_source_event_idx ON notification_events(source, source_event_id)`,
  `CREATE TABLE IF NOT EXISTS notification_digests (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    project_slug TEXT,
    title TEXT NOT NULL,
    body TEXT,
    metadata TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    window_end INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS notification_digests_source_type_idx ON notification_digests(source, type)`,
  `CREATE INDEX IF NOT EXISTS notification_digests_created_idx ON notification_digests(created_at)`,
  `CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    digest_id TEXT,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    delivered_at INTEGER,
    read_at INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    metadata TEXT NOT NULL,
    CHECK ((event_id IS NOT NULL AND digest_id IS NULL) OR (event_id IS NULL AND digest_id IS NOT NULL))
  )`,
  `CREATE INDEX IF NOT EXISTS notification_deliveries_event_idx ON notification_deliveries(event_id)`,
  `CREATE INDEX IF NOT EXISTS notification_deliveries_digest_idx ON notification_deliveries(digest_id)`,
  `CREATE INDEX IF NOT EXISTS notification_deliveries_channel_status_idx ON notification_deliveries(channel, status)`,
  `CREATE TABLE IF NOT EXISTS notification_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    source TEXT,
    event_type TEXT,
    severity TEXT,
    project_slug TEXT,
    condition TEXT,
    channels TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    preset TEXT NOT NULL,
    digest_window INTEGER NOT NULL DEFAULT 300,
    channels TEXT NOT NULL,
    quiet_hours TEXT,
    sounds TEXT,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_snoozes (
    source TEXT PRIMARY KEY,
    snoozed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
];

type DeliveryRow = typeof notificationDeliveries.$inferSelect;
type EventRow = typeof notificationEvents.$inferSelect;
type DigestRow = typeof notificationDigests.$inferSelect;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapEventRow(row: EventRow): NotificationEventRow {
  return {
    id: row.id,
    source: row.source,
    sourceEventId: row.sourceEventId,
    type: row.type,
    severity: row.severity as NotificationSeverity,
    projectSlug: row.projectSlug,
    title: row.title,
    body: row.body,
    metadata: parseJson(row.metadata, {}),
    occurredAt: row.occurredAt,
    ingestedAt: row.ingestedAt,
    batchId: row.batchId,
  };
}

function buildEventFeedItem(delivery: DeliveryRow, event: EventRow): NotificationFeedItem {
  return {
    deliveryId: delivery.id,
    recordType: "event",
    notificationId: event.id,
    source: event.source,
    type: event.type,
    severity: event.severity as NotificationSeverity,
    projectSlug: event.projectSlug,
    title: event.title,
    body: event.body,
    metadata: parseJson(event.metadata, {}),
    occurredAt: event.occurredAt,
    createdAt: event.ingestedAt,
    eventCount: null,
    status: delivery.status as NotificationFeedItem["status"],
    channel: delivery.channel as NotificationFeedItem["channel"],
    deliveredAt: delivery.deliveredAt,
    readAt: delivery.readAt,
  };
}

function buildDigestFeedItem(delivery: DeliveryRow, digest: DigestRow): NotificationFeedItem {
  return {
    deliveryId: delivery.id,
    recordType: "digest",
    notificationId: digest.id,
    source: digest.source,
    type: digest.type,
    severity: digest.severity as NotificationSeverity,
    projectSlug: digest.projectSlug,
    title: digest.title,
    body: digest.body,
    metadata: parseJson(digest.metadata, {}),
    occurredAt: digest.createdAt,
    createdAt: digest.createdAt,
    eventCount: digest.eventCount,
    status: delivery.status as NotificationFeedItem["status"],
    channel: delivery.channel as NotificationFeedItem["channel"],
    deliveredAt: delivery.deliveredAt,
    readAt: delivery.readAt,
  };
}

export class SqliteNotificationRepository implements NotificationRepository {
  private initialized = false;

  private async ensureTables(): Promise<void> {
    if (this.initialized) return;
    const db = getDb();
    for (const ddl of NOTIFICATION_DDL) {
      await db.run(sql.raw(ddl));
    }

    // Surgical migration: Add 'sounds' column if it doesn't exist
    try {
      await db.run(sql.raw("ALTER TABLE notification_preferences ADD COLUMN sounds TEXT"));
    } catch (_e) {
      // Ignore error if column already exists
    }

    this.initialized = true;
  }

  async insertEvent(event: NewNotificationEvent): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const occurredAt = event.occurredAt ?? nowSeconds();
    const ingestedAt = event.ingestedAt ?? nowSeconds();
    await db
      .insert(notificationEvents)
      .values({
        id: event.id,
        source: event.source,
        sourceEventId: event.sourceEventId ?? null,
        type: event.type,
        severity: event.severity,
        projectSlug: event.projectSlug ?? null,
        title: event.title,
        body: event.body ?? null,
        metadata: JSON.stringify(event.metadata ?? {}),
        occurredAt,
        ingestedAt,
        batchId: event.batchId ?? null,
      })
      .onConflictDoNothing();
  }

  async insertEvents(events: NewNotificationEvent[]): Promise<void> {
    for (const event of events) {
      await this.insertEvent(event);
    }
  }

  async getEvents(query: NotificationEventQuery = {}): Promise<NotificationEventRow[]> {
    await this.ensureTables();
    const db = getDb();
    const conditions: SQL[] = [];
    if (query.source) conditions.push(eq(notificationEvents.source, query.source));
    if (query.severity) conditions.push(eq(notificationEvents.severity, query.severity));
    if (query.projectSlug) conditions.push(eq(notificationEvents.projectSlug, query.projectSlug));
    if (query.before) conditions.push(lt(notificationEvents.occurredAt, query.before));

    const rows = await db
      .select()
      .from(notificationEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(notificationEvents.occurredAt))
      .limit(query.limit ?? 50);

    return rows.map(mapEventRow);
  }

  async getEventById(id: string): Promise<NotificationEventRow | null> {
    await this.ensureTables();
    const db = getDb();
    const row = await db
      .select()
      .from(notificationEvents)
      .where(eq(notificationEvents.id, id))
      .get();
    return row ? mapEventRow(row) : null;
  }

  async isDuplicate(source: string, sourceEventId: string): Promise<boolean> {
    await this.ensureTables();
    const db = getDb();
    const row = await db
      .select({ id: notificationEvents.id })
      .from(notificationEvents)
      .where(
        and(
          eq(notificationEvents.source, source),
          eq(notificationEvents.sourceEventId, sourceEventId)
        )
      )
      .get();
    return Boolean(row);
  }

  async insertDigest(digest: NewNotificationDigest): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.insert(notificationDigests).values({
      id: digest.id,
      source: digest.source,
      type: digest.type,
      severity: digest.severity,
      projectSlug: digest.projectSlug ?? null,
      title: digest.title,
      body: digest.body ?? null,
      metadata: JSON.stringify(digest.metadata ?? {}),
      eventCount: digest.eventCount,
      windowStart: digest.windowStart,
      windowEnd: digest.windowEnd,
      createdAt: digest.createdAt ?? nowSeconds(),
    });
  }

  async assignEventsToDigest(eventIds: string[], digestId: string): Promise<void> {
    await this.ensureTables();
    if (eventIds.length === 0) return;
    const db = getDb();
    await db
      .update(notificationEvents)
      .set({ batchId: digestId })
      .where(inArray(notificationEvents.id, eventIds));
  }

  async insertDelivery(delivery: NewNotificationDelivery): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.insert(notificationDeliveries).values({
      id: delivery.id,
      eventId: delivery.type === "event" ? delivery.eventId : null,
      digestId: delivery.type === "digest" ? delivery.digestId : null,
      channel: delivery.channel,
      status: delivery.status,
      deliveredAt: delivery.deliveredAt ?? null,
      readAt: delivery.readAt ?? null,
      retryCount: delivery.retryCount ?? 0,
      lastAttemptAt: delivery.lastAttemptAt ?? null,
      metadata: JSON.stringify(delivery.metadata ?? {}),
    });
  }

  async markRead(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const now = nowSeconds();
    await db
      .update(notificationDeliveries)
      .set({ status: "read", readAt: now })
      .where(eq(notificationDeliveries.id, id));
  }

  async markDismissed(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const now = nowSeconds();
    await db
      .update(notificationDeliveries)
      .set({ status: "dismissed", readAt: now })
      .where(eq(notificationDeliveries.id, id));
  }

  async markAllRead(filter?: { source?: string; projectSlug?: string }): Promise<void> {
    const feed = await this.getFeed({
      source: filter?.source,
      projectSlug: filter?.projectSlug,
      status: "unread",
      includeDismissed: false,
      limit: 5000,
    });
    if (feed.items.length === 0) return;
    const ids = feed.items.map((item) => item.deliveryId);
    const db = getDb();
    const now = nowSeconds();
    await db
      .update(notificationDeliveries)
      .set({ status: "read", readAt: now })
      .where(inArray(notificationDeliveries.id, ids));
  }

  async getUnreadCount(): Promise<number> {
    await this.ensureTables();
    const db = getDb();
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.channel, "in_app"),
          eq(notificationDeliveries.status, "delivered")
        )
      )
      .get();
    return Number(row?.count ?? 0);
  }

  async getFeed(query: NotificationFeedQuery = {}): Promise<PaginatedResult<NotificationFeedItem>> {
    await this.ensureTables();
    const db = getDb();
    const limit = query.limit ?? 50;

    const eventConditions = [eq(notificationDeliveries.channel, "in_app")];
    const digestConditions = [eq(notificationDeliveries.channel, "in_app")];

    if (!query.includeDismissed) {
      eventConditions.push(sql`${notificationDeliveries.status} != 'dismissed'`);
      digestConditions.push(sql`${notificationDeliveries.status} != 'dismissed'`);
    }

    if (query.status === "unread") {
      eventConditions.push(eq(notificationDeliveries.status, "delivered"));
      digestConditions.push(eq(notificationDeliveries.status, "delivered"));
    } else if (query.status === "read") {
      eventConditions.push(eq(notificationDeliveries.status, "read"));
      digestConditions.push(eq(notificationDeliveries.status, "read"));
    } else {
      eventConditions.push(sql`${notificationDeliveries.status} in ('delivered', 'read')`);
      digestConditions.push(sql`${notificationDeliveries.status} in ('delivered', 'read')`);
    }

    if (query.source) {
      eventConditions.push(eq(notificationEvents.source, query.source));
      digestConditions.push(eq(notificationDigests.source, query.source));
    }

    if (query.severity) {
      eventConditions.push(eq(notificationEvents.severity, query.severity));
      digestConditions.push(eq(notificationDigests.severity, query.severity));
    }

    if (query.projectSlug) {
      eventConditions.push(eq(notificationEvents.projectSlug, query.projectSlug));
      digestConditions.push(eq(notificationDigests.projectSlug, query.projectSlug));
    }

    if (query.cursor) {
      eventConditions.push(lt(notificationEvents.occurredAt, query.cursor));
      digestConditions.push(lt(notificationDigests.createdAt, query.cursor));
    }

    const eventRows = await db
      .select({ delivery: notificationDeliveries, event: notificationEvents })
      .from(notificationDeliveries)
      .innerJoin(notificationEvents, eq(notificationDeliveries.eventId, notificationEvents.id))
      .where(and(...eventConditions))
      .orderBy(desc(notificationEvents.occurredAt))
      .limit(limit);

    const digestRows = await db
      .select({ delivery: notificationDeliveries, digest: notificationDigests })
      .from(notificationDeliveries)
      .innerJoin(notificationDigests, eq(notificationDeliveries.digestId, notificationDigests.id))
      .where(and(...digestConditions))
      .orderBy(desc(notificationDigests.createdAt))
      .limit(limit);

    const items = [
      ...eventRows.map((row) => buildEventFeedItem(row.delivery, row.event)),
      ...digestRows.map((row) => buildDigestFeedItem(row.delivery, row.digest)),
    ]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit);

    return {
      items,
      nextCursor: items.length === limit ? (items[items.length - 1]?.occurredAt ?? null) : null,
    };
  }

  async getRules(): Promise<NotificationRuleRow[]> {
    await this.ensureTables();
    const db = getDb();
    const rows = await db.select().from(notificationRules).orderBy(notificationRules.name);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      source: row.source,
      eventType: row.eventType,
      severity: (row.severity as NotificationSeverity | null) ?? null,
      projectSlug: row.projectSlug,
      condition: parseJson(row.condition, null),
      channels: parseJson(row.channels, []),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertRule(rule: NotificationRuleRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(notificationRules)
      .values({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        source: rule.source,
        eventType: rule.eventType,
        severity: rule.severity,
        projectSlug: rule.projectSlug,
        condition: rule.condition ? JSON.stringify(rule.condition) : null,
        channels: JSON.stringify(rule.channels),
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      })
      .onConflictDoUpdate({
        target: notificationRules.id,
        set: {
          name: rule.name,
          enabled: rule.enabled,
          source: rule.source,
          eventType: rule.eventType,
          severity: rule.severity,
          projectSlug: rule.projectSlug,
          condition: rule.condition ? JSON.stringify(rule.condition) : null,
          channels: JSON.stringify(rule.channels),
          updatedAt: rule.updatedAt,
        },
      });
  }

  async deleteRule(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(notificationRules).where(eq(notificationRules.id, id));
  }

  async getPreferences(): Promise<NotificationPreferenceRow[]> {
    await this.ensureTables();
    const db = getDb();
    const rows = await db
      .select()
      .from(notificationPreferences)
      .orderBy(notificationPreferences.id);
    return rows.map((row) => ({
      id: row.id,
      enabled: row.enabled,
      preset: row.preset as NotificationPreferenceRow["preset"],
      digestWindow: row.digestWindow,
      channels: parseJson(row.channels, []),
      quietHours: parseJson(row.quietHours, null),
      sounds: parseJson(row.sounds, undefined),
      updatedAt: row.updatedAt,
    }));
  }

  async getPreference(id: string): Promise<NotificationPreferenceRow | null> {
    await this.ensureTables();
    const db = getDb();
    const row = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.id, id))
      .get();
    if (!row) return null;
    return {
      id: row.id,
      enabled: row.enabled,
      preset: row.preset as NotificationPreferenceRow["preset"],
      digestWindow: row.digestWindow,
      channels: parseJson(row.channels, []),
      quietHours: parseJson(row.quietHours, null),
      sounds: parseJson(row.sounds, undefined),
      updatedAt: row.updatedAt,
    };
  }

  async upsertPreference(pref: NotificationPreferenceRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(notificationPreferences)
      .values({
        id: pref.id,
        enabled: pref.enabled,
        preset: pref.preset,
        digestWindow: pref.digestWindow,
        channels: JSON.stringify(pref.channels),
        quietHours: pref.quietHours ? JSON.stringify(pref.quietHours) : null,
        sounds: pref.sounds ? JSON.stringify(pref.sounds) : null,
        updatedAt: pref.updatedAt,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.id,
        set: {
          enabled: pref.enabled,
          preset: pref.preset,
          digestWindow: pref.digestWindow,
          channels: JSON.stringify(pref.channels),
          quietHours: pref.quietHours ? JSON.stringify(pref.quietHours) : null,
          sounds: pref.sounds ? JSON.stringify(pref.sounds) : null,
          updatedAt: pref.updatedAt,
        },
      });
  }

  async getWebhookEndpoints(): Promise<WebhookEndpointRow[]> {
    await this.ensureTables();
    const db = getDb();
    const rows = await db.select().from(webhookEndpoints).orderBy(webhookEndpoints.name);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      secret: row.secret,
      events: parseJson(row.events, []),
      enabled: row.enabled,
      createdAt: row.createdAt,
    }));
  }

  async upsertWebhookEndpoint(endpoint: WebhookEndpointRow): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db
      .insert(webhookEndpoints)
      .values({
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        secret: endpoint.secret,
        events: JSON.stringify(endpoint.events),
        enabled: endpoint.enabled,
        createdAt: endpoint.createdAt,
      })
      .onConflictDoUpdate({
        target: webhookEndpoints.id,
        set: {
          name: endpoint.name,
          url: endpoint.url,
          secret: endpoint.secret,
          events: JSON.stringify(endpoint.events),
          enabled: endpoint.enabled,
        },
      });
  }

  async deleteWebhookEndpoint(id: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
  }

  async snoozeSource(source: string, durationMs: number): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    const snoozedAt = nowSeconds();
    const expiresAt = snoozedAt + Math.ceil(durationMs / 1000);
    await db
      .insert(notificationSnoozes)
      .values({ source, snoozedAt, expiresAt })
      .onConflictDoUpdate({
        target: notificationSnoozes.source,
        set: { snoozedAt, expiresAt },
      });
  }

  async unsnoozeSource(source: string): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(notificationSnoozes).where(eq(notificationSnoozes.source, source));
  }

  async getActiveSnoozes(now = nowSeconds()): Promise<NotificationSnoozeRow[]> {
    await this.ensureTables();
    const db = getDb();
    await db.delete(notificationSnoozes).where(lt(notificationSnoozes.expiresAt, now));
    const rows = await db
      .select()
      .from(notificationSnoozes)
      .where(sql`${notificationSnoozes.expiresAt} >= ${now}`);
    return rows.map((row) => ({
      source: row.source,
      snoozedAt: row.snoozedAt,
      expiresAt: row.expiresAt,
    }));
  }

  async pruneEvents(olderThan: number): Promise<number> {
    await this.ensureTables();
    const db = getDb();

    const oldEvents = await db
      .select({ id: notificationEvents.id })
      .from(notificationEvents)
      .where(lt(notificationEvents.occurredAt, olderThan));
    const oldDigests = await db
      .select({ id: notificationDigests.id })
      .from(notificationDigests)
      .where(lt(notificationDigests.createdAt, olderThan));

    const eventIds = oldEvents.map((row) => row.id);
    const digestIds = oldDigests.map((row) => row.id);

    if (eventIds.length > 0) {
      await db
        .delete(notificationDeliveries)
        .where(inArray(notificationDeliveries.eventId, eventIds));
      await db.delete(notificationEvents).where(inArray(notificationEvents.id, eventIds));
    }

    if (digestIds.length > 0) {
      await db
        .delete(notificationDeliveries)
        .where(inArray(notificationDeliveries.digestId, digestIds));
      await db.delete(notificationDigests).where(inArray(notificationDigests.id, digestIds));
    }

    await db.delete(notificationSnoozes).where(lt(notificationSnoozes.expiresAt, nowSeconds()));

    return eventIds.length + digestIds.length;
  }
}
