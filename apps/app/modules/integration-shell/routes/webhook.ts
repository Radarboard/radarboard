import "@/lib/integrations-init";

import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { WebhookHandler } from "@radarboard/integration-sdk/types";
import { createLogger } from "@radarboard/logger/logger";

const log = createLogger("api/webhooks");

import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { persistIntegrationArtifacts } from "@/lib/integration-artifacts";
import { emitNotificationEvents } from "@/lib/notifications";

export async function handleIntegrationWebhook(
  request: Request,
  integration: string
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const descriptor = INTEGRATION_REGISTRY.get(integration);
  const handler = descriptor?.webhookHandler;

  if (!handler) {
    await emitDebugEvent({
      level: "warn",
      source: "api/webhooks",
      eventType: "webhook.rejected",
      message: "Unknown webhook integration",
      requestId,
      entityType: "integration",
      entityId: integration,
      status: "rejected",
      metadata: { integration },
    });
    return errorJson(404, "Unknown integration");
  }

  const credRepo = getCredentialRepo();
  const creds = await credRepo.getCredential(`webhook_secret::${integration}`).catch(() => null);
  const secret = (creds as Record<string, string> | null)?.secret ?? "";

  if (!secret) {
    await emitDebugEvent({
      level: "warn",
      source: "api/webhooks",
      eventType: "webhook.rejected",
      message: "Webhook secret not configured",
      requestId,
      entityType: "integration",
      entityId: integration,
      status: "rejected",
      metadata: { integration },
    });
    return errorJson(401, "Webhook secret not configured for this integration");
  }

  const verified = await handler.verifySignature(request, secret);
  if (!verified) {
    await emitDebugEvent({
      level: "warn",
      source: "api/webhooks",
      eventType: "webhook.rejected",
      message: "Webhook signature verification failed",
      requestId,
      entityType: "integration",
      entityId: integration,
      status: "rejected",
      metadata: { integration },
    });
    return errorJson(401, "Invalid signature");
  }

  let events: Awaited<ReturnType<WebhookHandler["parsePayload"]>>;
  try {
    events = await handler.parsePayload(request);
  } catch (error) {
    log.error("Failed to parse webhook payload", { error });
    await emitDebugEvent({
      level: "error",
      source: "api/webhooks",
      eventType: "webhook.parse.failed",
      message: "Webhook payload parsing failed",
      requestId,
      entityType: "integration",
      entityId: integration,
      status: "failed",
      durationMs: Date.now() - startedAt,
      metadata: { integration },
    });
    return errorJson(400, "Failed to parse payload");
  }

  await persistIntegrationArtifacts(events);

  emitNotificationEvents(events);
  await emitDebugEvent({
    level: "info",
    source: "api/webhooks",
    eventType: "webhook.received",
    message: "Webhook received and parsed",
    requestId,
    entityType: "integration",
    entityId: integration,
    status: "completed",
    durationMs: Date.now() - startedAt,
    metadata: { integration, eventCount: events.length },
  });

  return NextResponse.json({ received: true, eventCount: events.length });
}
