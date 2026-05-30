# Notification Channels

This document captures the remaining implementation work for the two notification channels that are intentionally deferred:

- outbound webhooks
- email delivery

The notification system already has the core event pipeline, digest accumulator, settings UI, and persisted configuration. These notes describe how to finish the channel-specific delivery work without changing the current architecture.

## Current State

Implemented today:

- in-app delivery via `notification_deliveries`
- real-time updates via `/api/notifications/stream`
- desktop notifications via the browser Notification API
- endpoint configuration UI in `apps/app/components/settings-notifications.tsx`
- persistence for `webhook_endpoints` and `notification_preferences`
- digest batching in `packages/notifications/src/accumulator.ts`

Not implemented yet:

- outbound webhook POST delivery
- webhook retry/backoff logic
- webhook test-send endpoint
- email delivery via Resend
- scheduled info digests

## Outbound Webhook Channel

### Goal

Deliver notification events and digests to user-configured HTTP endpoints.

Examples:

- Slack incoming webhook proxies
- Discord webhooks
- Zapier / n8n catch hooks
- internal automation endpoints

### Existing Data Model

Already stored in `webhook_endpoints`:

- `id`
- `name`
- `url`
- `secret`
- `events`
- `enabled`
- `createdAt`

The settings UI already writes these rows through:

- `GET /api/notifications/webhooks`
- `POST /api/notifications/webhooks`
- `DELETE /api/notifications/webhooks`

### Implementation Plan

Create `apps/app/lib/notification-webhooks.ts` with a single server-side entrypoint:

```ts
export async function deliverWebhookNotification(
  notification: NotificationFeedItem | NotificationDigestRow,
  eventType: string
): Promise<void>
```

Responsibilities:

1. load enabled endpoints from `NotificationRepository`
2. glob-match `eventType` against `endpoint.events`
3. build a canonical JSON payload
4. HMAC-sign the raw payload with SHA-256 using `endpoint.secret`
5. `POST` to `endpoint.url`
6. record success/failure in `notification_deliveries.metadata`

### Payload Shape

Use one stable payload for both events and digests:

```json
{
  "id": "01J...",
  "kind": "event",
  "source": "sentry",
  "type": "error.spike",
  "severity": "critical",
  "title": "Error spike: auth-service",
  "body": "847 events in 15m",
  "projectSlug": "radarboard",
  "occurredAt": 1710877200,
  "metadata": {}
}
```

Digest payloads add:

- `kind: "digest"`
- `eventCount`
- `windowStart`
- `windowEnd`

### Signature

Headers:

- `Content-Type: application/json`
- `X-Radarboard-Event: <type>`
- `X-Radarboard-Signature: sha256=<hex>`

Signature input must be the exact raw JSON string sent in the body.

### Matching Rules

Endpoint `events` supports globs:

- `*`
- `deploy.*`
- `error.spike`
- `github.*`

Matching should happen in a tiny shared helper, not inline in the route or service.

Suggested file:

- `packages/notifications/src/glob.ts`

### Delivery Trigger Point

Hook the outbound channel into the same place that currently does in-app delivery:

- `deliverEventNow()`
- `deliverDigestNow()`

Do **not** add a second notification pipeline.

The delivery order should be:

1. persist event/digest
2. persist in-app delivery
3. enqueue or fire outbound webhooks

Failures must never block in-app delivery.

### Retry Policy

V1 can ship without retries if needed, but the code should be shaped so retries are easy to add.

Suggested fields already exist in `notification_deliveries`:

- `retryCount`
- `lastAttemptAt`

Suggested retry policy for later:

- retry on network failure or `5xx`
- do not retry `2xx`, `3xx`, or `4xx`
- backoff: `30s`, `2m`, `10m`
- cap at 3 attempts

### Test Endpoint

Add later:

- `POST /api/notifications/webhooks/test`

Request:

```json
{ "id": "endpoint-id" }
```

Behavior:

1. load endpoint
2. build a fixed test payload
3. sign and send it
4. return response status/body preview

The settings UI can then add a `Test` button per endpoint.

## Email Channel

### Goal

Use the existing Resend integration for:

- immediate critical alerts
- warning digests on window close
- scheduled info summaries

### Existing Foundation

Already available:

- Resend integration used by `/api/alerts/send`
- `notification_preferences.channels`
- digest accumulator
- persisted events and digests

### Delivery Modes

#### Critical

Send immediately from `deliverEventNow()` when:

- event severity is `critical`
- the relevant preference includes `email`

#### Warning

Send on digest flush from `deliverDigestNow()` when:

- digest severity is `warning`
- preference includes `email`

#### Info

Do not send from the real-time path.

Use a separate scheduled job:

- hourly
- daily
- weekly

This should be a later `EmailDigestScheduler`, not part of the accumulator itself.

### Implementation Plan

Create `apps/app/lib/notification-email.ts`:

```ts
export async function deliverNotificationEmail(...): Promise<void>
export async function sendScheduledInfoDigest(...): Promise<void>
```

Critical + warning can share a renderer with two templates:

- `renderEventEmail(event)`
- `renderDigestEmail(digest, events)`

### Recipient Source

This needs one explicit product decision before implementation:

- single app-wide recipient email
- one recipient per project
- multiple recipients per source or rule

Current recommendation for Radarboard:

- start with one app-wide recipient in settings

Store it in a dedicated settings key, not inside `notification_preferences`.

### Suggested Settings Additions

Add later to the Notifications settings page:

- recipient email address
- warning delivery mode: immediate vs digest-only
- info schedule: off / hourly / daily / weekly

### Scheduled Digest Job

Create later:

- `apps/app/lib/notification-email-scheduler.ts`

Behavior:

1. read schedule settings
2. query undelivered info events since last send
3. group by source
4. render summary email
5. mark email deliveries as sent

The scheduler should use persisted delivery records, not in-memory state.

## Order Of Future Work

Recommended sequence:

1. outbound webhook delivery implementation
2. webhook test-send route
3. email critical delivery
4. email warning digest delivery
5. scheduled info email digests

This keeps the easier stateless channel first and leaves the scheduler work until last.
