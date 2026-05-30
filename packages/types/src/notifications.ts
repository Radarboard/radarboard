export type NotificationSeverity = "critical" | "warning" | "info" | "success";

export type NotificationChannel = "in_app" | "email" | "desktop" | "webhook" | "mcp" | "sound";

export type NotificationDeliveryStatus = "pending" | "delivered" | "failed" | "read" | "dismissed";

export type NotificationPreset = "all" | "critical_only" | "deploys_and_errors" | "custom";

export type NotificationRecordType = "event" | "digest";

export type NotificationMetadata = Record<string, unknown>;

export type NotificationRuleConditionScope = "event" | "metadata";

export type NotificationRuleConditionValueType = "string" | "number" | "boolean";

export type NotificationRuleConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal";

export interface NotificationRuleCondition {
  scope: NotificationRuleConditionScope;
  field: string;
  operator: NotificationRuleConditionOperator;
  valueType: NotificationRuleConditionValueType;
  value: string | number | boolean;
}

export interface NotificationQuietHours {
  start: string;
  end: string;
  timezone: string;
}

export interface NotificationEventRow {
  id: string;
  source: string;
  sourceEventId: string | null;
  type: string;
  severity: NotificationSeverity;
  projectSlug: string | null;
  title: string;
  body: string | null;
  metadata: NotificationMetadata;
  occurredAt: number;
  ingestedAt: number;
  batchId: string | null;
}

export interface NewNotificationEvent {
  id: string;
  source: string;
  sourceEventId?: string | null;
  type: string;
  severity: NotificationSeverity;
  projectSlug?: string | null;
  title: string;
  body?: string | null;
  metadata?: NotificationMetadata;
  occurredAt?: number;
  ingestedAt?: number;
  batchId?: string | null;
}

export interface NotificationDigestRow {
  id: string;
  source: string;
  type: string;
  severity: NotificationSeverity;
  projectSlug: string | null;
  title: string;
  body: string | null;
  metadata: NotificationMetadata;
  eventCount: number;
  windowStart: number;
  windowEnd: number;
  createdAt: number;
}

export interface NewNotificationDigest {
  id: string;
  source: string;
  type: string;
  severity: NotificationSeverity;
  projectSlug?: string | null;
  title: string;
  body?: string | null;
  metadata?: NotificationMetadata;
  eventCount: number;
  windowStart: number;
  windowEnd: number;
  createdAt?: number;
}

interface NotificationDeliveryBase {
  id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  deliveredAt: number | null;
  readAt: number | null;
  retryCount: number;
  lastAttemptAt: number | null;
  metadata: NotificationMetadata;
}

export type NotificationDeliveryRow =
  | (NotificationDeliveryBase & {
      type: "event";
      eventId: string;
      digestId: null;
    })
  | (NotificationDeliveryBase & {
      type: "digest";
      eventId: null;
      digestId: string;
    });

export type NewNotificationDelivery =
  | {
      id: string;
      type: "event";
      eventId: string;
      digestId?: never;
      channel: NotificationChannel;
      status: NotificationDeliveryStatus;
      deliveredAt?: number | null;
      readAt?: number | null;
      retryCount?: number;
      lastAttemptAt?: number | null;
      metadata?: NotificationMetadata;
    }
  | {
      id: string;
      type: "digest";
      eventId?: never;
      digestId: string;
      channel: NotificationChannel;
      status: NotificationDeliveryStatus;
      deliveredAt?: number | null;
      readAt?: number | null;
      retryCount?: number;
      lastAttemptAt?: number | null;
      metadata?: NotificationMetadata;
    };

export interface NotificationRuleRow {
  id: string;
  name: string;
  enabled: boolean;
  source: string | null;
  eventType: string | null;
  severity: NotificationSeverity | null;
  projectSlug: string | null;
  condition: NotificationRuleCondition | null;
  channels: NotificationChannel[];
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreferenceRow {
  id: string;
  enabled: boolean;
  preset: NotificationPreset;
  digestWindow: number;
  channels: NotificationChannel[];
  quietHours: NotificationQuietHours | null;
  sounds?: Record<NotificationSeverity, string>;
  updatedAt: number;
}

export interface WebhookEndpointRow {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: number;
}

export interface NotificationSnoozeRow {
  source: string;
  snoozedAt: number;
  expiresAt: number;
}

export interface NotificationEventQuery {
  source?: string;
  severity?: NotificationSeverity;
  projectSlug?: string;
  limit?: number;
  before?: number;
}

export interface NotificationFeedQuery {
  source?: string;
  severity?: NotificationSeverity;
  projectSlug?: string;
  status?: "all" | "unread" | "read";
  includeDismissed?: boolean;
  limit?: number;
  cursor?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: number | null;
}

export interface NotificationFeedItem {
  deliveryId: string;
  recordType: NotificationRecordType;
  notificationId: string;
  source: string;
  type: string;
  severity: NotificationSeverity;
  projectSlug: string | null;
  title: string;
  body: string | null;
  metadata: NotificationMetadata;
  occurredAt: number;
  createdAt: number;
  eventCount: number | null;
  status: NotificationDeliveryStatus;
  channel: NotificationChannel;
  deliveredAt: number | null;
  readAt: number | null;
}

export interface EmitNotificationInput {
  source: string;
  sourceEventId?: string | null;
  type: string;
  severity: NotificationSeverity;
  projectSlug?: string | null;
  title: string;
  body?: string | null;
  /** Include `url` / `permalink` / nested link-like keys, or a bare URL in `body`/`title`, for clickable in-app notifications. */
  metadata?: NotificationMetadata;
  occurredAt?: number;
}

export type NotificationStreamMessage =
  | { type: "event"; payload: NotificationFeedItem }
  | { type: "badge"; payload: { unreadCount: number } }
  | {
      type: "status";
      payload: {
        deliveryId: string;
        status: Extract<NotificationDeliveryStatus, "read" | "dismissed">;
      };
    };
