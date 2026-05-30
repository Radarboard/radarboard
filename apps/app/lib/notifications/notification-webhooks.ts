import type {
  NewNotificationDigest,
  NewNotificationEvent,
  NotificationChannel,
  NotificationMetadata,
  WebhookEndpointRow,
} from "@radarboard/types/notifications";
import { getNotificationRepo } from "@/data/core/repository";
import { matchesAnyNotificationGlob } from "@/lib/notification-glob";

interface DeliveryTarget {
  kind: "event" | "digest";
  id: string;
  source: string;
  type: string;
  severity: string;
  projectSlug: string | null;
  title: string;
  body: string | null;
  metadata: NotificationMetadata;
  occurredAt: number;
  eventCount?: number;
  windowStart?: number;
  windowEnd?: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function buildPayload(target: DeliveryTarget): Record<string, unknown> {
  return {
    id: target.id,
    kind: target.kind,
    source: target.source,
    type: target.type,
    severity: target.severity,
    title: target.title,
    body: target.body,
    projectSlug: target.projectSlug,
    occurredAt: target.occurredAt,
    metadata: target.metadata,
    ...(target.kind === "digest"
      ? {
          eventCount: target.eventCount ?? 0,
          windowStart: target.windowStart,
          windowEnd: target.windowEnd,
        }
      : {}),
  };
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function insertWebhookDelivery(
  endpoint: WebhookEndpointRow,
  target: DeliveryTarget,
  status: "delivered" | "failed",
  metadata: NotificationMetadata,
  deliveredAt: number | null
): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) return;

  const base = {
    id: crypto.randomUUID(),
    channel: "webhook" as NotificationChannel,
    status,
    deliveredAt,
    readAt: null,
    retryCount: 0,
    lastAttemptAt: nowSeconds(),
    metadata: {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      url: endpoint.url,
      ...metadata,
    },
  };

  if (target.kind === "event") {
    await repo.insertDelivery({
      ...base,
      type: "event",
      eventId: target.id,
    });
    return;
  }

  await repo.insertDelivery({
    ...base,
    type: "digest",
    digestId: target.id,
  });
}

async function postToEndpoint(endpoint: WebhookEndpointRow, target: DeliveryTarget): Promise<void> {
  const payload = buildPayload(target);
  const body = JSON.stringify(payload);
  const signature = await hmacSha256(endpoint.secret, body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Radarboard-Event": target.type,
        "X-Radarboard-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      await insertWebhookDelivery(
        endpoint,
        target,
        "failed",
        { httpStatus: response.status },
        null
      );
      return;
    }

    await insertWebhookDelivery(
      endpoint,
      target,
      "delivered",
      { httpStatus: response.status },
      nowSeconds()
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await insertWebhookDelivery(endpoint, target, "failed", { error: message }, null);
  } finally {
    clearTimeout(timeout);
  }
}

async function postTestToEndpoint(endpoint: WebhookEndpointRow): Promise<{
  ok: boolean;
  status: number | null;
  error?: string;
}> {
  const target: DeliveryTarget = {
    kind: "event",
    id: crypto.randomUUID(),
    source: "radarboard",
    type: "notification.test",
    severity: "info",
    projectSlug: null,
    title: "Radarboard test webhook",
    body: "This is a signed test payload from Radarboard.",
    metadata: { test: true },
    occurredAt: nowSeconds(),
  };

  const payload = buildPayload(target);
  const body = JSON.stringify(payload);
  const signature = await hmacSha256(endpoint.secret, body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Radarboard-Event": target.type,
        "X-Radarboard-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverToMatchingEndpoints(target: DeliveryTarget): Promise<void> {
  const repo = getNotificationRepo();
  if (!repo) return;

  const endpoints = await repo.getWebhookEndpoints();
  const matching = endpoints.filter(
    (endpoint) => endpoint.enabled && matchesAnyNotificationGlob(target.type, endpoint.events)
  );

  await Promise.allSettled(matching.map((endpoint) => postToEndpoint(endpoint, target)));
}

export async function deliverWebhookEvent(event: NewNotificationEvent): Promise<void> {
  await deliverToMatchingEndpoints({
    kind: "event",
    id: event.id,
    source: event.source,
    type: event.type,
    severity: event.severity,
    projectSlug: event.projectSlug ?? null,
    title: event.title,
    body: event.body ?? null,
    metadata: event.metadata ?? {},
    occurredAt: event.occurredAt ?? nowSeconds(),
  });
}

export async function deliverWebhookDigest(digest: NewNotificationDigest): Promise<void> {
  await deliverToMatchingEndpoints({
    kind: "digest",
    id: digest.id,
    source: digest.source,
    type: digest.type,
    severity: digest.severity,
    projectSlug: digest.projectSlug ?? null,
    title: digest.title,
    body: digest.body ?? null,
    metadata: digest.metadata ?? {},
    occurredAt: digest.createdAt ?? nowSeconds(),
    eventCount: digest.eventCount,
    windowStart: digest.windowStart,
    windowEnd: digest.windowEnd,
  });
}

export async function sendTestWebhook(endpointId: string): Promise<{
  ok: boolean;
  status: number | null;
  endpointName?: string;
  error?: string;
}> {
  const repo = getNotificationRepo();
  if (!repo) {
    return { ok: false, status: null, error: "Notifications not supported by current provider" };
  }

  const endpoints = await repo.getWebhookEndpoints();
  const endpoint = endpoints.find((item) => item.id === endpointId);
  if (!endpoint) {
    return { ok: false, status: null, error: "Webhook endpoint not found" };
  }

  const result = await postTestToEndpoint(endpoint);
  return { ...result, endpointName: endpoint.name };
}
