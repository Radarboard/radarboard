# Notification System Design

**Date:** 2026-03-19  
**Status:** Draft  
**Scope:** Core notification infrastructure — event bus, processing pipeline, delivery channels, UI, MCP integration

---

## Overview

Radarboard gains a core **Notification System** — a unified event-driven pipeline that captures activity and anomalies from all 13+ integrations, processes them through configurable rules and smart batching, and delivers them across five channels: in-app notification center, email digests, desktop notifications, outbound webhooks, and MCP tools.

The system is designed around two complementary use cases:

1. **Activity feed**: A timeline of everything happening across integrations — PRs merged, deploys completed, downloads counted, revenue received. Context at a glance.
2. **Anomaly alerts**: Elevated-priority notifications for things that need attention — error spikes, service outages, revenue drops, failed deployments. Proactive monitoring.

Priority tiers (`critical`, `warning`, `info`) determine batching behavior, delivery urgency, and visual treatment.

---

## Architecture

### Event-Driven Pipeline

```
Sources (polling delta, inbound webhooks, plugins, threshold evaluator)
    ↓
  EventBus (in-process singleton, typed EventEmitter)
    ↓
  Processing Pipeline
    1. Ingest   → deduplicate by sourceEventId, persist raw event
    2. Filter   → match against user preferences + custom rules
    3. Batch    → digest window accumulator (group by source+type+project)
    4. Deliver  → route to enabled channels
    ↓
  Channels (in-app, email, desktop, webhook, MCP)
    ↓
  NotificationRepository (extends DatabaseAdapter)
```

This is a **core system**, not a plugin. The event bus is foundational infrastructure that all integrations feed into. Plugins can extend it (emit events, subscribe to events) but the backbone lives in a dedicated package.

### Why Event-Driven Pipeline

- Clean separation of concerns — each pipeline stage is independently testable
- In-process `EventEmitter` is lightweight for a single-user app
- Mirrors the existing logger pub/sub pattern (`LogRingBuffer`)
- Pipeline stages are pluggable — easy to add new filters, enrichers, channels
- MCP integration is natural (events as resources, tools for querying/acknowledging)
- Leaves the door open for external message brokers if Radarboard ever goes multi-user

Alternatives considered:
- **Database-centric queue**: Simpler but adds polling latency for processing, harder for real-time delivery (desktop notifications need push), and batch logic in SQL is awkward
- **Actor model**: Per-integration isolated actors. Perfect isolation but over-engineered for single-user; harder to query across integrations

---

## Package Structure

### New Package: `@radarboard/notifications`

Event bus, pipeline logic, channels, and sources. This package contains the **domain logic** — no DB implementations.

```
packages/notifications/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── event-bus.ts                # NotificationEventBus singleton
│   ├── pipeline/
│   │   ├── ingest.ts               # Dedup + validate + persist
│   │   ├── filter.ts               # Rule matching + preference checking
│   │   ├── batch.ts                # DigestAccumulator (window-based batching)
│   │   └── deliver.ts              # Route to channels
│   ├── channels/
│   │   ├── types.ts                # DeliveryChannel interface
│   │   ├── in-app.ts               # DB write + SSE push
│   │   ├── email.ts                # Resend integration
│   │   ├── desktop.ts              # SSE → browser Notification API
│   │   ├── webhook.ts              # HMAC-signed outbound POST
│   │   └── mcp.ts                  # MCP resource/notification updates
│   ├── sources/
│   │   ├── delta-detector.ts       # Polling change detection
│   │   ├── threshold-evaluator.ts  # Rule-based threshold checking
│   │   └── webhook-parsers/        # Inbound webhook payload parsers
│   │       ├── github.ts
│   │       ├── vercel.ts
│   │       ├── sentry.ts
│   │       ├── linear.ts
│   │       └── betterstack.ts
│   ├── types.ts                    # All notification types
│   └── utils.ts                    # ULID generation, glob matching
├── package.json
└── tsconfig.json
```

### Repository Implementations (in `apps/app/db/`)

The `NotificationRepository` **interface** is defined in `packages/types/src/database.ts`. The **implementations** live alongside existing repository implementations:

```
apps/app/db/
├── sqlite-notifications.ts            # SQLite implementation
├── supabase-notifications.ts          # Supabase implementation
├── turso-notifications.ts             # Turso implementation
├── planetscale-notifications.ts       # PlanetScale implementation
```

This follows the existing flat naming convention (`sqlite-cache.ts`, `supabase-cache.ts`, `sqlite-llm.ts`, etc.).

### DatabaseAdapter Interface Change

Add `notifications` to the `DatabaseAdapter` interface in `packages/types/src/database.ts`:

```typescript
interface DatabaseAdapter {
  cache: CacheRepository;
  settings: SettingsRepository;
  credentials: CredentialRepository;
  llm?: LlmRepository;        // existing — lazy-initialized, optional
  plugins?: PluginRepository;  // existing — lazy-initialized, optional
  notifications?: NotificationRepository; // NEW — lazy-initialized, optional
}
```

The `notifications` property is optional (like `llm` and `plugins`) so the system degrades gracefully if a provider hasn't implemented it yet. Phase 1 implements SQLite and Supabase; Turso and PlanetScale follow as needed.

### New API Routes

```
apps/app/app/api/
├── notifications/
│   ├── route.ts                    # GET feed (paginated), POST mark-read/mark-dismissed/mark-all-read
│   ├── stream/route.ts             # SSE endpoint for real-time push
│   ├── rules/route.ts              # CRUD for custom notification rules
│   ├── preferences/route.ts        # Get/update notification preferences
│   ├── webhooks/route.ts           # CRUD for outbound webhook endpoints
│   └── test-webhook/route.ts       # Send test payload to a webhook endpoint
├── webhooks/                       # Inbound webhook receivers
│   ├── github/route.ts
│   ├── vercel/route.ts
│   ├── sentry/route.ts
│   ├── linear/route.ts
│   └── betterstack/route.ts
```

### New Hooks (`packages/hooks/src/`)

```
use-notifications.ts             # SWR hook for notification feed (paginated, filtered)
use-notification-stream.ts       # SSE subscription for real-time updates
use-unread-count.ts              # Badge count (lightweight, high-frequency)
use-notification-preferences.ts  # Read/write global + per-integration preferences
use-notification-rules.ts        # CRUD for custom rules
use-webhook-endpoints.ts         # CRUD for outbound webhook endpoints
```

### New Components (`apps/app/components/`)

```
notification-bell.tsx            # Topbar bell icon + animated badge
notification-dropdown.tsx        # Quick popover (5 recent, "View all")
notification-panel.tsx           # Full slide-over panel (filters, tabs, bulk actions)
notification-item.tsx            # Single notification row (shared between dropdown + panel)
notification-filters.tsx         # Tab bar + source/project filter dropdowns
settings-notifications.tsx       # Settings page (follows SettingsPageLayout pattern)
```

---

## Data Model

### Database Tables (Drizzle schema additions)

#### `notification_events`

Raw events from all sources. The activity feed backbone.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text (ULID) | Sortable unique ID |
| `source` | text | Integration name: `github`, `vercel`, `sentry`, `linear`, `betterstack`, `revenuecat`, `app-store-connect`, `openpanel`, `google-search-console`, `npm`, `opencollective`, `plugin:{id}` |
| `sourceEventId` | text (nullable) | Dedup key from origin (e.g., GitHub webhook delivery ID, Sentry event ID) |
| `type` | text | Event type: `pr.opened`, `deploy.failed`, `error.spike`, `revenue.drop`, etc. |
| `severity` | text | `critical` \| `warning` \| `info` |
| `projectSlug` | text (nullable) | Which project this relates to |
| `title` | text | Human-readable summary |
| `body` | text (nullable) | Detail/context (markdown supported) |
| `metadata` | text (JSON) | Arbitrary structured data from the source |
| `occurredAt` | integer | Unix ms — when the event actually happened |
| `ingestedAt` | integer | Unix ms — when Radarboard received it |
| `batchId` | text (nullable) | FK to `notification_digests` (null if unbatched) |

Indexes: `(source, type)`, `(severity)`, `(projectSlug)`, `(occurredAt DESC)`. Partial unique index on `(sourceEventId)` where `sourceEventId IS NOT NULL` — events without a `sourceEventId` (threshold evaluator, some polling deltas) are exempt from dedup at the DB level. Note: PlanetScale/MySQL does not support partial unique indexes natively; the implementation must use a composite unique on `(source, sourceEventId)` where the source ensures uniqueness scope, or handle dedup in application code with a SELECT-before-INSERT for those providers.

#### `notification_digests`

Batched groups of events created by the digest window accumulator.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text (ULID) | Digest ID |
| `source` | text | Integration |
| `type` | text | Event type pattern |
| `severity` | text | Highest severity in batch |
| `projectSlug` | text (nullable) | Project scope |
| `title` | text | Digest summary: "8 new GitHub issues" |
| `eventCount` | integer | Number of events in this digest |
| `windowStart` | integer | Batch window start (Unix ms) |
| `windowEnd` | integer | Batch window end (Unix ms) |
| `createdAt` | integer | Unix ms |

#### `notification_deliveries`

Track what was delivered where, delivery status, and read state.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text (ULID) | Delivery ID |
| `eventId` | text (nullable) | FK to `notification_events.id` — set for single-event deliveries |
| `digestId` | text (nullable) | FK to `notification_digests.id` — set for digest deliveries |
| `channel` | text | `in_app` \| `email` \| `desktop` \| `webhook` \| `mcp` |
| `status` | text | `pending` \| `delivered` \| `failed` \| `read` \| `dismissed` |
| `deliveredAt` | integer (nullable) | Unix ms |
| `readAt` | integer (nullable) | Unix ms |
| `retryCount` | integer | Default 0 — for future webhook retry support |
| `lastAttemptAt` | integer (nullable) | Unix ms — for future retry scheduling |
| `metadata` | text (JSON) | Channel-specific data (webhook response status, email ID, etc.) |

Exactly one of `eventId` or `digestId` must be set. This is enforced at three levels:
1. **Type level:** `NewNotificationDelivery` is a discriminated union: `{ type: 'event'; eventId: string } | { type: 'digest'; digestId: string }` plus shared fields. This prevents passing both or neither at compile time.
2. **Application level:** The `deliver` stage constructs deliveries — it always sets exactly one FK based on whether it received an event or a digest.
3. **Database level (where supported):** SQLite and Supabase/Postgres add a CHECK constraint: `CHECK ((eventId IS NOT NULL AND digestId IS NULL) OR (eventId IS NULL AND digestId IS NOT NULL))`. PlanetScale/MySQL skips this (CHECK constraints are parsed but not enforced in MySQL <8.0.16).

This avoids polymorphic FKs and enables direct joins.

**`read` vs `dismissed` semantics:** `read` means the user has seen the notification (clicked or marked as read). `dismissed` means the user explicitly hid it — dismissed notifications are excluded from the feed but still counted in analytics. Both clear the unread count.

Indexes: `(eventId)`, `(digestId)`, `(channel, status)`, `(status)` for unread queries.

**Feed query strategy (`getFeed`):** The query joins `notification_deliveries` (filtered to `channel = 'in_app'`) with `notification_events` via `eventId` and `notification_digests` via `digestId` using two LEFT JOINs. Results are ordered by `COALESCE(events.occurredAt, digests.createdAt) DESC` with cursor-based pagination on the delivery ID.

#### `notification_rules`

User-configured custom alert rules with threshold conditions.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text (ULID) | Rule ID |
| `name` | text | Human-readable name |
| `enabled` | integer | 0/1 |
| `source` | text (nullable) | Integration filter (null = all) |
| `eventType` | text (nullable) | Event type pattern, supports glob: `deploy.*`, `error.spike` |
| `severity` | text (nullable) | Minimum severity filter |
| `projectSlug` | text (nullable) | Project filter (null = all) |
| `condition` | text (JSON) | Threshold condition: `{"field": "count", "op": ">", "value": 50, "window": "1h"}` |
| `channels` | text (JSON) | Delivery channels: `["in_app", "email"]` |
| `createdAt` | integer | Unix ms |
| `updatedAt` | integer | Unix ms |

#### `notification_preferences`

Global and per-integration notification preferences.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text | `global` or integration name (e.g., `github`, `sentry`) |
| `enabled` | integer | Master toggle for this scope |
| `preset` | text | `all` \| `critical_only` \| `deploys_and_errors` \| `custom` |
| `digestWindow` | integer | Seconds — batch window size (default 300 = 5 min) |
| `channels` | text (JSON) | Default channels: `["in_app", "desktop"]` |
| `quietHours` | text (JSON, nullable) | `{"start": "22:00", "end": "08:00", "timezone": "America/New_York"}` |
| `updatedAt` | integer | Unix ms |

#### `webhook_endpoints`

Outbound webhook configuration.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text (ULID) | Endpoint ID |
| `name` | text | Human label |
| `url` | text | Target URL |
| `secret` | text | HMAC signing secret for payload verification |
| `events` | text (JSON) | Event type filter with glob: `["*.critical", "deploy.*", "error.spike"]` |
| `enabled` | integer | 0/1 |
| `createdAt` | integer | Unix ms |

#### `notification_snoozes`

Temporary mute state for integrations, set via MCP `snooze_source` tool or settings UI.

| Column | Type | Purpose |
|--------|------|---------|
| `source` | text (PK) | Integration name being snoozed |
| `snoozedAt` | integer | Unix ms — when snooze started |
| `expiresAt` | integer | Unix ms — when snooze expires |

The filter stage checks this table: if `source` matches and `expiresAt > now`, the event is suppressed (all severities). Expired rows are cleaned up on read. The `SnoozeState` is loaded once at pipeline startup and refreshed on writes.

### NotificationRepository Interface

Added to the `DatabaseAdapter` pattern (new repo, same as `CacheRepository`, `SettingsRepository`, etc.):

```typescript
interface NotificationRepository {
  // Events
  insertEvent(event: NewNotificationEvent): Promise<void>;
  insertEvents(events: NewNotificationEvent[]): Promise<void>;
  getEvents(query: EventQuery): Promise<PaginatedResult<NotificationEvent>>;
  getEventById(id: string): Promise<NotificationEvent | null>;
  isDuplicate(source: string, sourceEventId: string): Promise<boolean>;

  // Digests
  insertDigest(digest: NewNotificationDigest): Promise<void>;
  assignEventsToDigest(eventIds: string[], digestId: string): Promise<void>;

  // Deliveries
  insertDelivery(delivery: NewNotificationDelivery): Promise<void>;
  markDelivered(id: string): Promise<void>;
  markRead(id: string): Promise<void>;
  markDismissed(id: string): Promise<void>;
  markAllRead(filter?: { source?: string; projectSlug?: string }): Promise<void>;
  getUnreadCount(): Promise<number>;

  // Feed (unified view for the notification center UI)
  getFeed(query: FeedQuery): Promise<PaginatedResult<FeedItem>>;

  // Rules
  getRules(): Promise<NotificationRule[]>;
  upsertRule(rule: NotificationRule): Promise<void>;
  deleteRule(id: string): Promise<void>;

  // Preferences
  getPreferences(): Promise<NotificationPreference[]>;
  upsertPreference(pref: NotificationPreference): Promise<void>;

  // Webhook Endpoints
  getWebhookEndpoints(): Promise<WebhookEndpoint[]>;
  upsertWebhookEndpoint(endpoint: WebhookEndpoint): Promise<void>;
  deleteWebhookEndpoint(id: string): Promise<void>;

  // Snooze
  snoozeSource(source: string, durationMs: number): Promise<void>;
  unsnoozeSource(source: string): Promise<void>;
  getActiveSnoozes(): Promise<Array<{ source: string; expiresAt: number }>>;

  // Maintenance
  pruneEvents(olderThanMs: number): Promise<number>;
}
```

Each database provider (SQLite, Supabase, Turso, PlanetScale) gets its own implementation file, consistent with existing repository patterns.

---

## Event Bus

### `NotificationEventBus`

```typescript
type Severity = 'critical' | 'warning' | 'info';

interface NotificationEvent {
  id: string;                          // ULID (generated at emit time)
  source: string;                      // Integration identifier
  sourceEventId?: string;              // Dedup key from origin
  type: string;                        // Hierarchical event type (e.g., 'pr.opened')
  severity: Severity;
  projectSlug?: string;
  title: string;
  body?: string;
  metadata: Record<string, unknown>;
  occurredAt: number;                  // Unix ms
}

interface EventFilter {
  source?: string | string[];
  type?: string;                       // Glob pattern supported
  severity?: Severity | Severity[];
  projectSlug?: string;
}

class NotificationEventBus {
  private emitter: EventEmitter;

  // Subscribe to events matching a filter
  on(filter: EventFilter, handler: (event: NotificationEvent) => void): () => void;

  // Emit a single event into the pipeline
  emit(event: Omit<NotificationEvent, 'id'>): void;

  // Emit a batch (e.g., from polling delta detection)
  emitBatch(events: Omit<NotificationEvent, 'id'>[]): void;

  // Get singleton instance
  static getInstance(): NotificationEventBus;
}
```

The bus is a **singleton per process**. It is the only entry point for events into the notification system. All sources — polling detection, inbound webhooks, plugins, threshold evaluator — feed through `emit()` or `emitBatch()`.

---

## Processing Pipeline

### Stage 1: Ingest

```typescript
async function ingest(
  event: NotificationEvent,
  repo: NotificationRepository
): Promise<boolean> {
  // 1. Deduplicate: if sourceEventId is set, check for existing
  if (event.sourceEventId) {
    const isDup = await repo.isDuplicate(event.source, event.sourceEventId);
    if (isDup) return false;
  }
  // 2. Persist raw event
  await repo.insertEvent(event);
  return true;
}
```

### Stage 2: Filter

```typescript
interface FilterResult {
  notify: boolean;
  matchedRules: NotificationRule[];
  channels: Channel[];
}

function shouldNotify(
  event: NotificationEvent,
  preferences: NotificationPreference[],
  rules: NotificationRule[],
  snoozeState: SnoozeState
): FilterResult {
  // 1. Check global kill switch (preferences where id='global', enabled=0)
  // 2. Check snooze state — if source is snoozed and snooze hasn't expired, suppress ALL severities
  // 3. Check per-integration enabled + preset
  // 4. Check quiet hours:
  //    - critical severity ALWAYS bypasses quiet hours (never suppressed)
  //    - warning + info are suppressed during quiet hours
  //    - Timezone comparison uses Intl.DateTimeFormat with the IANA zone from preferences
  //    - Compare current time in the user's timezone against start/end range
  // 5. Match against custom threshold rules (glob on type, severity filter)
  // 6. Determine delivery channels (rule-specific overrides → integration default → global default)
}
```

Presets map to severity filters:
- `all`: all severities
- `critical_only`: only `critical`
- `deploys_and_errors`: `critical` + `warning` + types matching `deploy.*` or `error.*`
- `custom`: defer to custom rules

### Stage 3: Batch (Digest Window Accumulator)

```typescript
interface WindowState {
  key: string;                         // source:type:projectSlug
  events: NotificationEvent[];
  openedAt: number;
  digestWindow: number;                // milliseconds
}

class DigestAccumulator {
  private windows: Map<string, WindowState>;
  private flushTimer: NodeJS.Timeout;

  // Add event to appropriate window
  accumulate(event: NotificationEvent, digestWindowMs: number): void {
    const key = `${event.source}:${event.type}:${event.projectSlug ?? '*'}`;
    // Open window if new, add event to existing window
  }

  // Called every second — flushes windows past their deadline
  flush(): Array<NotificationEvent | NotificationDigest> {
    // For each expired window:
    //   - 1 event → pass through as-is (no digest)
    //   - 2+ events → create NotificationDigest, assign events to it
  }
}
```

**Key behaviors:**
- Window opens on first event, closes after `digestWindow` ms
- `critical` severity **bypasses batching entirely** — always delivered immediately
- Window size is configurable per integration via `notification_preferences.digestWindow`
- Default: 300 seconds (5 minutes)
- **Process restart:** Pending batch windows are held in-memory and lost on process restart (deploy, crash, dev reload). This is acceptable because unbatched events are already persisted in `notification_events` by the ingest stage — they appear individually in the feed rather than as a digest. No data is lost, only the batching grouping.

### Stage 4: Deliver

```typescript
interface DeliveryChannel {
  id: string;
  deliver(notification: DeliverableNotification): Promise<DeliveryResult>;
}

interface DeliverableNotification {
  event?: NotificationEvent;           // Single event
  digest?: NotificationDigest;         // Or batched digest
  channels: string[];                  // Target channels
}

interface DeliveryResult {
  channel: string;
  status: 'delivered' | 'failed';
  metadata?: Record<string, unknown>;
}
```

The deliver stage iterates over requested channels and calls each `DeliveryChannel` implementation, recording results in `notification_deliveries`.

---

## Delivery Channels

### In-App (`InAppChannel`)

- Writes a delivery record with `channel: 'in_app'`, `status: 'delivered'`
- Pushes the notification to the SSE stream at `/api/notifications/stream`
- Client-side: `useNotificationStream()` receives the event and prepends it to the feed

### Email (`EmailChannel`)

- Uses the existing `@radarboard/api` Resend client
- **Critical**: Sent immediately by the deliver stage, formatted HTML alert (similar to existing `sendHealthAlert()`)
- **Warning**: Sent when the `DigestAccumulator` window closes — the deliver stage receives the digest and sends a single email per source summarizing all events in the window
- **Info**: NOT sent by the `DigestAccumulator`. Instead, a separate **`EmailDigestScheduler`** runs on a configurable cron-like interval (hourly/daily/weekly, configured in notification preferences). It queries `notification_events` for undelivered info-level events since the last email digest, groups them by source, and sends a single summary email. This is a second, longer-duration batch layer operating independently of the real-time pipeline.

```typescript
class EmailDigestScheduler {
  // Runs on setInterval matching the user's configured schedule
  // (e.g., every hour, or once daily at a configured time)
  async sendScheduledDigest(): Promise<void> {
    // 1. Read email schedule preference (hourly/daily/weekly)
    // 2. Query info-level events not yet delivered via email since last digest
    // 3. Group by source, format summary email
    // 4. Send via Resend, record deliveries
  }
}
```

- Records Resend message ID in delivery metadata

### Desktop (`DesktopChannel`)

- Pushes via the same SSE stream with a `desktop` flag
- Client-side: `useNotificationStream()` checks for desktop flag → calls `Notification` API
- Only fires when the browser tab is not focused (uses `document.hasFocus()`)
- Requires one-time permission grant (prompted on first notification settings save)
- Falls back to in-app only if permission denied

### Webhook (`WebhookChannel`)

- Queries `webhook_endpoints` table for enabled endpoints matching the event type (glob match)
- Signs payload with HMAC-SHA256 using the endpoint's secret
- POST to the configured URL with headers:
  - `Content-Type: application/json`
  - `X-Radarboard-Signature: sha256=<hex>`
  - `X-Radarboard-Event: <event.type>`
  - `X-Radarboard-Delivery: <delivery.id>`
- Records HTTP status in delivery metadata
- No automatic retries in v1 (can add exponential backoff later)

**Webhook payload format:**
```json
{
  "id": "<event or digest id>",
  "type": "pr.opened",
  "source": "github",
  "severity": "info",
  "title": "PR #482 merged: Add dark mode support",
  "body": "by @daviddias into main — 14 files changed",
  "projectSlug": "project-x",
  "occurredAt": 1710864000000,
  "metadata": { ... }
}
```

### MCP (`McpChannel`)

- Updates MCP resources so connected LLMs see new notifications on next resource read
- For active MCP sessions, sends a log notification (MCP logging protocol)
- No persistent connection required — stateless resource model

---

## Event Sources

### A. Polling Delta Detection (`DeltaDetector`)

Wraps existing SWR polling to detect changes between consecutive API responses:

```typescript
class DeltaDetector {
  private previousState: Map<string, unknown>;

  detect(
    source: string,
    type: string,
    currentData: unknown,
    options: { idField: string; projectSlug?: string }
  ): NotificationEvent[] {
    // Compare current items with previous state by idField
    // Emit events for new items (not seen before)
    // Update previousState
  }
}
```

**Restart behavior:** `previousState` is held in-memory and lost on process restart. On the first poll after restart, the detector seeds its state from the `api_cache` table (last cached response for each integration). If no cache exists, the first poll establishes the baseline and emits no events (avoids a flood of false "new" events). The dedup stage in the ingest pipeline provides a second safety net — if a webhook already delivered the same event, the `sourceEventId` check prevents duplicates.

Integration points — added to each API route's response handler or as SWR `onSuccess` middleware:

| Source | Detection Logic | Events Generated |
|--------|----------------|-----------------|
| GitHub (issues) | New issue IDs | `issue.opened` |
| GitHub (PRs) | New PR IDs, status changes | `pr.opened`, `pr.merged`, `pr.closed` |
| GitHub (stars) | Count increase | `star.received` (digest) |
| Vercel | New deployment IDs, state changes | `deploy.started`, `deploy.succeeded`, `deploy.failed` |
| Sentry | New issue IDs, event count spikes | `error.new`, `error.spike` |
| Linear | New issue IDs, state changes | `issue.created`, `issue.completed` |
| BetterStack | Monitor status changes | `monitor.down`, `monitor.up` |
| RevenueCat | Revenue delta, subscriber count delta | `revenue.daily_summary`, `subscriber.new` |
| App Store Connect | New reviews, version status changes | `review.new`, `version.approved`, `version.rejected` |
| npm | Download count delta, new versions | `downloads.daily_summary`, `version.published` |
| OpenPanel | Session/pageview spikes | `analytics.daily_summary`, `analytics.spike` |
| Google Search Console | Ranking changes | `seo.daily_summary`, `ranking.change` |
| Open Collective | New transactions | `donation.received`, `expense.approved` |

### B. Inbound Webhook Receivers

New API routes under `/api/webhooks/{integration}`:

Each receiver:
1. Verifies the webhook signature (HMAC-SHA256 for GitHub/Vercel, token for Sentry, etc.)
2. Parses the platform-specific payload into a `NotificationEvent`
3. Calls `eventBus.emit(event)`
4. Returns `200 OK` with `{ received: true }`

**Webhook signature verification per platform:**
- **GitHub**: `X-Hub-Signature-256` header, HMAC-SHA256 with configured secret
- **Vercel**: `x-vercel-signature` header, HMAC-SHA1 with secret
- **Sentry**: `sentry-hook-signature` header, HMAC-SHA256 with secret
- **BetterStack**: IP allowlist or token-based
- **Linear**: `Linear-Signature` header, HMAC-SHA256

**Configuration:** Webhook secrets are stored in `widget_credentials` with keys like `webhook_secret::github`. The settings UI provides setup instructions with the webhook URL and copy-to-clipboard for each integration.

### C. Plugin Events

Extend `PluginAPI` in `packages/plugins/src/types.ts`:

```typescript
// Added to PluginAPI interface
events: {
  emit(event: {
    type: string;
    severity: Severity;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }): void;

  on(
    filter: { source?: string; type?: string },
    handler: (event: NotificationEvent) => void
  ): () => void;
};
```

Plugin-emitted events are prefixed with `plugin:{pluginId}` as the source. The `PluginHost` bridges plugin `events.emit()` calls to the `NotificationEventBus`.

### D. Threshold Evaluator

Runs on a 60-second interval server-side (via `setInterval` in the API initialization). Reads custom rules with `condition` fields and evaluates them against data from the **`api_cache` table** (the `CacheRepository`), which stores recent API responses from all integrations.

```typescript
class ThresholdEvaluator {
  constructor(
    private cacheRepo: CacheRepository,
    private notificationRepo: NotificationRepository,
    private eventBus: NotificationEventBus
  ) {}

  async evaluate(rules: NotificationRule[]): Promise<void> {
    for (const rule of rules) {
      if (!rule.enabled || !rule.condition) continue;
      // 1. Read the relevant cached API data from CacheRepository
      //    e.g., for source "sentry", read the cached Sentry issues response
      const cachedData = await this.cacheRepo.get(rule.source ?? '');
      if (!cachedData) continue;
      // 2. Extract the field specified in condition and apply the operator
      // 3. Check cooldown: query notification_events for recent threshold.breached
      //    events from this rule within the cooldown window
      // 4. If breached and not in cooldown, emit event via eventBus
    }
  }
}
```

**Data source:** The evaluator reads from `CacheRepository` (`api_cache` table), NOT from client-side SWR cache. The `api_cache` table is populated by every API route response and is accessible server-side. This gives the evaluator access to the most recent polled data from all integrations.

**Supported condition operators:** `>`, `<`, `>=`, `<=`, `==`, `!=`, `change_pct` (percentage change over window)

**Cooldown:** After a threshold rule fires, it enters a cooldown period (default: same as the time window in the condition) to prevent repeated alerts for the same ongoing condition. Cooldown state is derived from querying recent `threshold.breached` events in `notification_events`, not held in memory.

---

## MCP Integration

### New MCP Tools (added to `/api/mcp/route.ts`)

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_notifications` | Query notification feed with filters | `source?`, `severity?`, `projectSlug?`, `since?`, `limit?` |
| `get_unread_count` | Get unread notification count | — |
| `acknowledge_notification` | Mark a notification as read | `id` |
| `dismiss_notification` | Dismiss a notification (hide from feed) | `id` |
| `acknowledge_all` | Mark all as read, with optional filter | `source?`, `projectSlug?` |
| `create_notification_rule` | Create a custom alert rule | `name`, `source?`, `eventType?`, `severity?`, `condition?`, `channels` |
| `get_notification_summary` | AI-optimized digest of recent activity | `period?` (default: `24h`) |
| `snooze_source` | Temporarily mute an integration | `source`, `durationMinutes` |

### `get_notification_summary` Response Format

Designed for LLM consumption — structured, concise, actionable:

```json
{
  "period": "last_24h",
  "summary": "3 critical, 12 warnings, 45 info events across 8 integrations",
  "critical": [
    {
      "id": "01JQXYZ...",
      "title": "Sentry: Error spike in auth-service (847 events in 15 min)",
      "source": "sentry",
      "time": "2h ago",
      "acknowledged": false
    }
  ],
  "warnings": [
    {
      "title": "3 failed Vercel deployments in 30 min",
      "source": "vercel",
      "time": "4h ago"
    }
  ],
  "highlights": [
    "GitHub: 8 PRs merged in project-x",
    "Revenue: $1,240 in App Store sales (↑12% vs yesterday)",
    "npm: 8,241 downloads across 3 packages",
    "BetterStack: All 5 monitors up (100% uptime)"
  ]
}
```

### MCP Resources

```
notifications://feed                    # Latest notifications (paginated)
notifications://feed?source=github      # Filtered by source
notifications://unread                  # Unread count + recent unread items
notifications://rules                   # Current notification rules
notifications://preferences             # Current preferences
```

---

## UI Design

### Notification Bell (Topbar)

- Bell icon (Lucide `Bell`) added to the existing topbar, left of settings gear
- Badge: unread count, max "99+", red background for critical unread, blue for non-critical unread only
- Subtle pulse animation on new critical notification
- Click → opens dropdown popover

### Notification Dropdown (Quick View)

- **Trigger**: Click bell icon
- **Size**: ~360px wide, max height 480px
- **Header**: "Notifications" title + "Mark all read" text button
- **Body**: Last 5 unread notifications (compact variant — title + source badge + timestamp, no body text)
- **Footer**: "View all notifications →" link → opens full panel
- **Behavior**: Dismisses on outside click, Escape key, or clicking "View all"

### Notification Panel (Full View)

- **Trigger**: "View all" from dropdown, or `Cmd+Shift+N` keyboard shortcut
- **Position**: Right-side slide-over, ~450px wide, overlays dashboard
- **Header**: "Notifications" + unread count badge + "Mark all read" button + close (X) button
- **Filter bar**:
  - Tabs: All | Critical | Warnings | Info (with counts per tab)
  - Source dropdown: filter by integration
  - Project dropdown: filter by project
- **Feed**: Scrollable list of `NotificationItem` components
- **Notification item design** (applies to both dropdown compact and panel full views):
  - Left: severity color bar (3px, red/orange/transparent)
  - Icon: integration-specific, in severity-tinted circle
  - Top-right: relative timestamp
  - Severity + source label (uppercase, colored)
  - Title (bold)
  - Body text (secondary color, 1-2 lines)
  - Tags: project slug, digest count ("3 events grouped"), read state
  - Unread items have a subtle background tint matching severity
  - Read items are dimmed (opacity)
- **Bulk actions**: Select multiple → "Mark read", "Dismiss"
- **Empty state**: "All caught up" with illustration
- **Pagination**: Infinite scroll, 20 items per page

### Settings Page: Notifications

Follows existing `SettingsPageLayout` + `SettingsGrid` pattern. Reference: `settings-integrations.tsx`.

**Sections:**

1. **Global Preferences**
   - Master toggle: enable/disable all notifications
   - Default channels: checkboxes (in-app, email, desktop)
   - Quiet hours: time range picker + timezone
   - Default digest window: slider (1 min → 1 hour, default 5 min)

2. **Per-Integration Preferences** (3-column `SettingsGrid`)
   - One card per connected integration
   - Card: icon, name, enable/disable toggle, preset dropdown (`All` / `Critical only` / `Deploys & errors` / `Custom`), channel override checkboxes, custom digest window

3. **Custom Rules**
   - Table of rules: name, source, condition summary, channels, enabled toggle
   - "Add rule" → form with: name, source filter, event type pattern, severity filter, project filter, condition builder (field + op + value + window), channel selection
   - Pre-built templates: "Error spike (>50/hour)", "Revenue drop (>10% day-over-day)", "Deploy failure", "Service down"

4. **Webhook Endpoints**
   - Table: name, URL (masked), event filter summary, enabled toggle, last delivery status
   - "Add endpoint" → form with: name, URL, secret (auto-generated with copy button), event type filter (multi-select with glob support)
   - "Test" button per endpoint → sends test payload and shows response

5. **Email Schedule**
   - Critical: always immediate (not configurable)
   - Warning: dropdown (Immediate / Hourly digest / Daily digest)
   - Info: dropdown (Hourly / Daily / Weekly / Disabled)

---

## Real-Time Delivery

### SSE Endpoint: `/api/notifications/stream`

Extends the existing SSE pattern from `/api/logs/stream`:

```typescript
// Message types
type SSEMessage =
  | { type: 'event'; payload: NotificationEvent }
  | { type: 'digest'; payload: NotificationDigest }
  | { type: 'badge'; payload: { unreadCount: number } }
  | { type: 'heartbeat' };
```

- 30-second heartbeat keepalive (same as log stream)
- `InAppChannel` and `DesktopChannel` both publish to this stream
- Badge updates are sent on every state change (read, new event, etc.)

### Client Hooks

**`useNotificationStream()`**: Subscribes to SSE, merges events into the SWR cache:
- On `type: 'event'` or `type: 'digest'` → mutate the SWR notification feed cache (prepend)
- On `type: 'badge'` → update the unread count

**`useUnreadCount()`**: Lightweight hook that returns the badge count. Initially fetched via SWR (`GET /api/notifications?count_only=true`), then kept in sync by the SSE stream.

**Desktop notification flow**:
1. SSE delivers event with desktop flag
2. `useNotificationStream()` checks `document.hasFocus()` — if not focused, fires `new Notification()`
3. Click on desktop notification → focuses the Radarboard tab and opens the notification panel

---

## Integration Point Map

| Integration | Polling Delta | Inbound Webhook | Example Events |
|-------------|:---:|:---:|----------------|
| **GitHub** | ✓ | ✓ | `pr.opened`, `pr.merged`, `issue.opened`, `star.received` |
| **Vercel** | ✓ | ✓ | `deploy.started`, `deploy.succeeded`, `deploy.failed` |
| **Sentry** | ✓ | ✓ | `error.new`, `error.spike`, `error.resolved` |
| **Linear** | ✓ | ✓ | `issue.created`, `issue.completed`, `cycle.completed` |
| **BetterStack** | ✓ | ✓ | `monitor.down`, `monitor.up`, `incident.created` |
| **RevenueCat** | ✓ | — | `revenue.daily_summary`, `subscriber.new`, `subscriber.churned` |
| **App Store Connect** | ✓ | — | `review.new`, `version.approved`, `version.rejected` |
| **OpenPanel** | ✓ | — | `analytics.daily_summary`, `analytics.spike` |
| **Google Search Console** | ✓ | — | `seo.daily_summary`, `ranking.change` |
| **npm** | ✓ | — | `downloads.daily_summary`, `version.published` |
| **Open Collective** | ✓ | — | `donation.received`, `expense.approved` |
| **Plugins** | — | — | Any event via `PluginAPI.events.emit()` |

---

## Event Type Taxonomy

Hierarchical naming: `{category}.{action}` with glob matching support.

```
# Deployments
deploy.started
deploy.succeeded
deploy.failed
deploy.cancelled

# Errors / Monitoring
error.new
error.spike
error.resolved
monitor.down
monitor.up
incident.created
incident.resolved

# Code / Development
pr.opened
pr.merged
pr.closed
issue.opened
issue.closed
issue.completed
star.received
commit.pushed

# Revenue / Business
revenue.daily_summary
subscriber.new
subscriber.churned
donation.received
expense.approved

# Analytics
analytics.daily_summary
analytics.spike
seo.daily_summary
ranking.change

# Packages
downloads.daily_summary
version.published

# App Store
review.new
version.approved
version.rejected
version.submitted

# Custom (plugins / threshold rules)
threshold.breached
plugin.custom
```

---

## Plugin API Extension

```typescript
// Added to PluginAPI (packages/plugins/src/types.ts)
events: {
  /**
   * Emit a notification event from this plugin.
   * Source will be set to `plugin:{pluginId}` automatically.
   */
  emit(event: {
    type: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }): void;

  /**
   * Subscribe to notification events.
   * Returns an unsubscribe function.
   */
  on(
    filter: { source?: string; type?: string },
    handler: (event: NotificationEvent) => void
  ): () => void;
};
```

The `PluginHost` implementation bridges these calls:
- `events.emit()` → `NotificationEventBus.getInstance().emit({ ...event, source: \`plugin:${pluginId}\` })`
- `events.on()` → `NotificationEventBus.getInstance().on(filter, handler)`

---

## Data Retention & Maintenance

- **Default retention**: 30 days for all tables (events, digests, deliveries). Pruning is implemented in application code (not SQL `ON DELETE CASCADE`) to remain portable across all four DB providers. `pruneEvents()` deletes events older than the retention period, then deletes deliveries and digests whose referenced events no longer exist.
- **Pruning**: `pruneEvents()` runs daily (or on app startup), deletes events older than retention period
- **Configurable** via a future settings field (not in v1 — hardcoded defaults)
- **Storage estimate**: ~500 bytes per event, 10,000 events/month = ~5 MB/month. Negligible for all supported database providers.

---

## Error Handling

- **Channel delivery failures** are recorded in `notification_deliveries` with `status: 'failed'` and error details in `metadata`. They do not block other channels.
- **Webhook timeouts**: 10-second timeout per outbound webhook. Failed deliveries are logged but not retried in v1.
- **SSE disconnections**: Client `useNotificationStream()` implements auto-reconnect with exponential backoff (same pattern as log stream). On reconnect, fetches missed notifications via SWR.
- **Event bus errors**: Individual handler errors are caught and logged, never propagate to other handlers.
- **Inbound webhook failures**: Return appropriate HTTP status codes. Invalid signatures → 401. Parse errors → 400. Internal errors → 500 (with error logged).

---

## Testing Strategy

- **Unit tests**: Each pipeline stage (ingest, filter, batch, deliver) tested in isolation with mock repositories
- **Integration tests**: End-to-end event flow from `eventBus.emit()` through to delivery channel calls
- **Webhook parser tests**: Fixture-based tests with real payloads from each integration
- **Batch accumulator tests**: Time-based tests verifying window behavior, critical bypass, flush logic
- **Channel tests**: Mock external services (Resend, fetch for webhooks) to verify payload format and signing

---

## Implementation Phases

### Phase 1: Core Infrastructure
- `@radarboard/notifications` package with event bus, types, pipeline stages
- Database schema + Drizzle migrations + NotificationRepository (SQLite + Supabase)
- SSE endpoint for real-time push
- In-app delivery channel

### Phase 2: UI
- Notification bell + dropdown popover
- Full slide-over panel with filters
- `useNotifications`, `useNotificationStream`, `useUnreadCount` hooks
- Settings page (global preferences + per-integration)

### Phase 3: Smart Features
- DeltaDetector integration with existing API routes
- DigestAccumulator batch processing
- Threshold evaluator + custom rules UI
- Preset rule templates

### Phase 4: External Channels
- Email channel (Resend) with digest formatting
- Desktop notification channel
- Outbound webhook channel + settings UI
- Inbound webhook receivers (GitHub, Vercel, Sentry, BetterStack, Linear)

### Phase 5: MCP
- MCP tools (get_notifications, get_notification_summary, acknowledge, create_rule, snooze_source)
- MCP resources (notifications://feed, notifications://unread, etc.)
- Plugin API extension (events.emit, events.on)
