import { DigestAccumulator } from "@radarboard/notifications/accumulator";
import { notificationEventBus } from "@radarboard/notifications/event-bus";
import { notificationStreamHub } from "@radarboard/notifications/stream-hub";
import type { RoutingConfig } from "@radarboard/types/database";
import type {
  EmitNotificationInput,
  NewNotificationDigest,
  NewNotificationEvent,
  NotificationChannel,
  NotificationEventRow,
  NotificationFeedItem,
  NotificationPreferenceRow,
  NotificationQuietHours,
  NotificationRuleCondition,
  NotificationRuleRow,
  NotificationSeverity,
} from "@radarboard/types/notifications";
import { resolveRoutingSurfaceAccess } from "@radarboard/utils/routing";
import { getNotificationRepo, getSettingsRepo } from "@/data/core/repository";
import { matchesNotificationGlob } from "@/lib/notification-glob";
import { deliverWebhookDigest, deliverWebhookEvent } from "@/lib/notification-webhooks";

interface RoutingDecision {
  channels: NotificationChannel[];
  digestWindowMs: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function defaultGlobalPreference(): NotificationPreferenceRow {
  return {
    id: "global",
    enabled: true,
    preset: "all",
    digestWindow: 300,
    channels: ["in_app"],
    quietHours: null,
    updatedAt: nowSeconds(),
  };
}

function formatClockInTimeZone(timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date());
}

function isWithinQuietHours(quietHours: NotificationQuietHours | null): boolean {
  if (!quietHours) return false;
  const current = formatClockInTimeZone(quietHours.timezone);
  const { start, end } = quietHours;
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function basePresetAllows(pref: NotificationPreferenceRow, event: EmitNotificationInput): boolean {
  switch (pref.preset) {
    case "critical_only":
      return event.severity === "critical";
    case "deploys_and_errors":
      return (
        event.severity === "critical" ||
        event.severity === "warning" ||
        /^(deploy|error)\./.test(event.type)
      );
    case "custom":
      return false;
    default:
      return true;
  }
}

function severityRank(severity: NotificationSeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function ruleMatches(rule: NotificationRuleRow, event: EmitNotificationInput): boolean {
  if (!rule.enabled) return false;
  if (rule.source && rule.source !== event.source) return false;
  if (rule.eventType && !matchesNotificationGlob(event.type, rule.eventType)) return false;
  if (rule.projectSlug && rule.projectSlug !== (event.projectSlug ?? null)) return false;
  if (rule.severity && severityRank(event.severity) < severityRank(rule.severity)) return false;
  if (rule.condition && !conditionMatches(rule.condition, event)) return false;
  return true;
}

function eventFieldValue(event: EmitNotificationInput, field: string): unknown {
  switch (field) {
    case "source":
      return event.source;
    case "type":
      return event.type;
    case "severity":
      return event.severity;
    case "projectSlug":
      return event.projectSlug ?? null;
    case "title":
      return event.title;
    case "body":
      return event.body ?? null;
    default:
      return undefined;
  }
}

function conditionValue(
  condition: NotificationRuleCondition,
  event: EmitNotificationInput
): unknown {
  if (condition.scope === "event") {
    return eventFieldValue(event, condition.field);
  }
  return event.metadata?.[condition.field];
}

function conditionMatches(
  condition: NotificationRuleCondition,
  event: EmitNotificationInput
): boolean {
  const actual = conditionValue(condition, event);
  if (actual === undefined || actual === null) return false;

  if (condition.valueType === "number") {
    const actualNumber = Number(actual);
    const expectedNumber = Number(condition.value);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    switch (condition.operator) {
      case "equals":
        return actualNumber === expectedNumber;
      case "not_equals":
        return actualNumber !== expectedNumber;
      case "greater_than":
        return actualNumber > expectedNumber;
      case "greater_than_or_equal":
        return actualNumber >= expectedNumber;
      case "less_than":
        return actualNumber < expectedNumber;
      case "less_than_or_equal":
        return actualNumber <= expectedNumber;
      case "contains":
        return String(actualNumber).includes(String(expectedNumber));
      default:
        return false;
    }
  }

  if (condition.valueType === "boolean") {
    const actualBoolean = actual === true || actual === "true";
    const expectedBoolean = condition.value === true || condition.value === "true";
    switch (condition.operator) {
      case "equals":
        return actualBoolean === expectedBoolean;
      case "not_equals":
        return actualBoolean !== expectedBoolean;
      default:
        return false;
    }
  }

  const actualString = String(actual).toLowerCase();
  const expectedString = String(condition.value).toLowerCase();
  switch (condition.operator) {
    case "equals":
      return actualString === expectedString;
    case "not_equals":
      return actualString !== expectedString;
    case "contains":
      return actualString.includes(expectedString);
    case "greater_than":
      return actualString > expectedString;
    case "greater_than_or_equal":
      return actualString >= expectedString;
    case "less_than":
      return actualString < expectedString;
    case "less_than_or_equal":
      return actualString <= expectedString;
    default:
      return false;
  }
}

function normalizeChannels(channels: Iterable<NotificationChannel>): NotificationChannel[] {
  const set = new Set(channels);
  if (set.has("desktop")) {
    set.add("in_app");
  }
  return [...set].sort();
}

function routingSignature(channels: NotificationChannel[]): string {
  return normalizeChannels(channels).join("|") || "none";
}

function buildEventFeedItem(
  event: NewNotificationEvent,
  deliveryId: string,
  deliveredAt: number
): NotificationFeedItem {
  return {
    deliveryId,
    recordType: "event",
    notificationId: event.id,
    source: event.source,
    type: event.type,
    severity: event.severity,
    projectSlug: event.projectSlug ?? null,
    title: event.title,
    body: event.body ?? null,
    metadata: event.metadata ?? {},
    occurredAt: event.occurredAt ?? deliveredAt,
    createdAt: deliveredAt,
    eventCount: null,
    status: "delivered",
    channel: "in_app",
    deliveredAt,
    readAt: null,
  };
}

function buildDigestFeedItem(
  digest: NewNotificationDigest,
  deliveryId: string,
  deliveredAt: number
): NotificationFeedItem {
  return {
    deliveryId,
    recordType: "digest",
    notificationId: digest.id,
    source: digest.source,
    type: digest.type,
    severity: digest.severity,
    projectSlug: digest.projectSlug ?? null,
    title: digest.title,
    body: digest.body ?? null,
    metadata: digest.metadata ?? {},
    occurredAt: digest.createdAt ?? deliveredAt,
    createdAt: digest.createdAt ?? deliveredAt,
    eventCount: digest.eventCount,
    status: "delivered",
    channel: "in_app",
    deliveredAt,
    readAt: null,
  };
}

async function deliverInAppEvent(event: NewNotificationEvent): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) return;
  const deliveredAt = nowSeconds();
  const deliveryId = crypto.randomUUID();
  await repo.insertDelivery({
    id: deliveryId,
    type: "event",
    eventId: event.id,
    channel: "in_app",
    status: "delivered",
    deliveredAt,
    readAt: null,
    retryCount: 0,
    lastAttemptAt: deliveredAt,
    metadata: {},
  });
  const feedItem = buildEventFeedItem(event, deliveryId, deliveredAt);
  const unreadCount = await repo.getUnreadCount();
  notificationStreamHub.publish({ type: "event", payload: feedItem });
  notificationStreamHub.publish({ type: "badge", payload: { unreadCount } });
}

async function deliverInAppDigest(
  digest: NewNotificationDigest,
  eventIds: string[]
): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) return;

  await repo.insertDigest(digest);
  await repo.assignEventsToDigest(eventIds, digest.id);

  const deliveredAt = nowSeconds();
  const deliveryId = crypto.randomUUID();
  await repo.insertDelivery({
    id: deliveryId,
    type: "digest",
    digestId: digest.id,
    channel: "in_app",
    status: "delivered",
    deliveredAt,
    readAt: null,
    retryCount: 0,
    lastAttemptAt: deliveredAt,
    metadata: {},
  });
  const feedItem = buildDigestFeedItem(digest, deliveryId, deliveredAt);
  const unreadCount = await repo.getUnreadCount();
  notificationStreamHub.publish({ type: "event", payload: feedItem });
  notificationStreamHub.publish({ type: "badge", payload: { unreadCount } });
}

async function deliverEventNow(
  event: NewNotificationEvent,
  channels: NotificationChannel[]
): Promise<void> {
  if (channels.includes("in_app")) {
    await deliverInAppEvent(event);
  }

  if (channels.includes("webhook")) {
    deliverWebhookEvent(event).catch(() => {
      // intentional fire-and-forget swallow
    });
  }
}

async function deliverDigestNow(
  digest: NewNotificationDigest,
  eventIds: string[],
  channels: NotificationChannel[]
): Promise<void> {
  const needsPersistedDigest = channels.includes("in_app") || channels.includes("webhook");
  if (!needsPersistedDigest) return;

  if (channels.includes("in_app")) {
    await deliverInAppDigest(digest, eventIds);
  } else {
    const repo = getNotificationRepo();
    if (!repo) return;
    await repo.insertDigest(digest);
    await repo.assignEventsToDigest(eventIds, digest.id);
  }

  if (channels.includes("webhook")) {
    deliverWebhookDigest(digest).catch(() => {
      // intentional fire-and-forget swallow
    });
  }
}

const accumulator = new DigestAccumulator(
  async ({ source, type, projectSlug, events, channels, windowStart, windowEnd }) => {
    if (events.length === 1 && events[0]) {
      await deliverEventNow(events[0], channels);
      return;
    }

    const getSeverity = (): NotificationSeverity => {
      if (events.some((event) => event.severity === "critical")) return "critical";
      if (events.some((event) => event.severity === "warning")) return "warning";
      if (events.some((event) => event.severity === "info")) return "info";
      return "success";
    };
    const severity = getSeverity();

    const digest: NewNotificationDigest = {
      id: crypto.randomUUID(),
      source,
      type,
      severity,
      projectSlug,
      title: `${events.length} ${source} ${type.replace(".", " ")} events`,
      body: null,
      metadata: {
        debugEventIds: events
          .map((event) => event.metadata?.debugEventId)
          .filter((id): id is string => typeof id === "string"),
      },
      eventCount: events.length,
      windowStart,
      windowEnd,
      createdAt: windowEnd,
    };

    await deliverDigestNow(
      digest,
      events.map((event) => event.id),
      channels
    );
  }
);

let flushTimerStarted = false;

function ensureFlushTimer(): void {
  if (flushTimerStarted) return;
  flushTimerStarted = true;
  setInterval(() => {
    accumulator.tick();
  }, 5_000);
}

async function resolvePreferenceForSource(source: string): Promise<NotificationPreferenceRow> {
  const repo = getNotificationRepo();
  if (!repo) return defaultGlobalPreference();
  const global = (await repo.getPreference("global")) ?? defaultGlobalPreference();
  const sourcePref = await repo.getPreference(source);
  return sourcePref ?? global;
}

async function resolveSharedRoutingConfig(): Promise<RoutingConfig> {
  try {
    return await getSettingsRepo().getRoutingConfig();
  } catch {
    return { rules: [] };
  }
}

async function shouldSkipNotification(
  input: EmitNotificationInput,
  repo: NonNullable<ReturnType<typeof getNotificationRepo>>
): Promise<boolean> {
  if (input.sourceEventId && (await repo.isDuplicate(input.source, input.sourceEventId))) {
    return true;
  }

  const snoozes = await repo.getActiveSnoozes();
  if (snoozes.some((snooze) => snooze.source === input.source)) {
    return true;
  }

  return false;
}

async function resolvePreferenceGate(
  input: EmitNotificationInput
): Promise<NotificationPreferenceRow | null> {
  const pref = await resolvePreferenceForSource(input.source);
  if (!pref.enabled) return null;
  if (input.severity !== "critical" && isWithinQuietHours(pref.quietHours)) {
    return null;
  }

  return pref;
}

async function notificationsAllowedByRouting(
  input: EmitNotificationInput,
  pref: NotificationPreferenceRow
): Promise<boolean> {
  const baselineAllowed = basePresetAllows(pref, input);
  const routingConfig = await resolveSharedRoutingConfig();
  return resolveRoutingSurfaceAccess("notifications", baselineAllowed, routingConfig, {
    source: input.source,
    type: input.type,
    severity: input.severity,
    projectSlug: input.projectSlug ?? null,
    title: input.title,
    body: input.body ?? null,
    metadata: input.metadata ?? {},
  });
}

function collectNotificationChannels(
  pref: NotificationPreferenceRow,
  matchedRules: NotificationRuleRow[]
): NotificationChannel[] {
  const channels = new Set<NotificationChannel>();
  for (const channel of pref.channels) {
    channels.add(channel);
  }

  for (const rule of matchedRules) {
    for (const channel of rule.channels) {
      channels.add(channel);
    }
  }

  return normalizeChannels(channels);
}

async function resolveRouting(input: EmitNotificationInput): Promise<RoutingDecision | null> {
  const repo = getNotificationRepo();
  if (!repo) return null;
  if (await shouldSkipNotification(input, repo)) {
    return null;
  }

  const pref = await resolvePreferenceGate(input);
  if (!pref) {
    return null;
  }

  if (!(await notificationsAllowedByRouting(input, pref))) {
    return null;
  }

  const rules = await repo.getRules();
  const matchedRules = rules.filter((rule) => ruleMatches(rule, input));
  const normalizedChannels = collectNotificationChannels(pref, matchedRules);

  if (normalizedChannels.length === 0) {
    return null;
  }

  return {
    channels: normalizedChannels,
    digestWindowMs: (pref.digestWindow ?? 300) * 1000,
  };
}

export async function getNotificationPreferences(): Promise<NotificationPreferenceRow[]> {
  const repo = getNotificationRepo();
  if (!repo) return [defaultGlobalPreference()];
  const prefs = await repo.getPreferences();
  if (prefs.some((pref) => pref.id === "global")) return prefs;
  const global = defaultGlobalPreference();
  await repo.upsertPreference(global);
  return [global, ...prefs];
}

export async function upsertNotificationPreference(pref: NotificationPreferenceRow): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) {
    throw new Error("Notifications are not supported by the current database provider");
  }
  await repo.upsertPreference(pref);
}

export async function emitNotificationEvent(
  input: EmitNotificationInput
): Promise<NotificationFeedItem | null> {
  const repo = getNotificationRepo();
  if (!repo) return null;

  ensureFlushTimer();

  const routing = await resolveRouting(input);
  if (!routing) return null;

  const ingestedAt = nowSeconds();
  const event: NewNotificationEvent = {
    id: crypto.randomUUID(),
    source: input.source,
    sourceEventId: input.sourceEventId ?? null,
    type: input.type,
    severity: input.severity,
    projectSlug: input.projectSlug ?? null,
    title: input.title,
    body: input.body ?? null,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt ?? ingestedAt,
    ingestedAt,
    batchId: null,
  };

  await repo.insertEvent(event);

  const eventRow: NotificationEventRow = {
    id: event.id,
    source: event.source,
    sourceEventId: event.sourceEventId ?? null,
    type: event.type,
    severity: event.severity,
    projectSlug: event.projectSlug ?? null,
    title: event.title,
    body: event.body ?? null,
    metadata: event.metadata ?? {},
    occurredAt: event.occurredAt ?? ingestedAt,
    ingestedAt: event.ingestedAt ?? ingestedAt,
    batchId: null,
  };

  notificationEventBus.emit(eventRow);

  if (input.severity === "critical") {
    await deliverEventNow(event, routing.channels);
    return null;
  }

  accumulator.add(
    eventRow,
    routing.digestWindowMs,
    routing.channels,
    routingSignature(routing.channels)
  );
  return null;
}

export function emitNotificationEvents(inputs: EmitNotificationInput[]): void {
  for (const input of inputs) {
    emitNotificationEvent(input).catch(() => {
      // Intentional fire-and-forget swallow
    });
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) throw new Error("Notifications not supported by current database provider");
  await repo.markRead(id);
  const unreadCount = await repo.getUnreadCount();
  notificationStreamHub.publish({ type: "status", payload: { deliveryId: id, status: "read" } });
  notificationStreamHub.publish({ type: "badge", payload: { unreadCount } });
}

export async function dismissNotification(id: string): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) throw new Error("Notifications not supported by current database provider");
  await repo.markDismissed(id);
  const unreadCount = await repo.getUnreadCount();
  notificationStreamHub.publish({
    type: "status",
    payload: { deliveryId: id, status: "dismissed" },
  });
  notificationStreamHub.publish({ type: "badge", payload: { unreadCount } });
}

export async function markAllNotificationsRead(filter?: {
  source?: string;
  projectSlug?: string;
}): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) throw new Error("Notifications not supported by current database provider");
  await repo.markAllRead(filter);
  const unreadCount = await repo.getUnreadCount();
  notificationStreamHub.publish({ type: "badge", payload: { unreadCount } });
}
