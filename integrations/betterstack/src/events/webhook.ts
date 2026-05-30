/**
 * BetterStack — Inbound webhook handler
 *
 * BetterStack sends monitor status change webhooks.
 * Authentication: shared secret token passed as a custom header.
 * Docs: https://betterstack.com/docs/uptime/webhooks/
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { IntegrationEvent, WebhookHandler } from "@radarboard/integration-sdk/types";

interface BetterStackWebhookPayload {
  on_call_integration?: unknown;
  data?: {
    id?: string;
    type?: "monitor" | "heartbeat";
    attributes?: {
      url?: string;
      pronounceable_name?: string;
      status?: "up" | "down" | "validating" | "pending" | "maintenance" | "paused";
      cause?: string;
      started_at?: string;
      resolved_at?: string | null;
    };
  };
  incident?: {
    id: string;
    attributes: {
      name: string;
      url: string;
      cause: string;
      started_at: string;
      resolved_at: string | null;
    };
  };
}

function mapIncident(
  incident: NonNullable<BetterStackWebhookPayload["incident"]>
): IntegrationEvent {
  const resolved = Boolean(incident.attributes.resolved_at);
  return {
    source: "betterstack",
    sourceEventId: `betterstack:incident:${incident.id}:${resolved ? "resolved" : "created"}`,
    type: resolved ? "monitor.up" : "monitor.down",
    severity: resolved ? "info" : "critical",
    title: resolved
      ? `${incident.attributes.name} is back up`
      : `${incident.attributes.name} is DOWN`,
    body: incident.attributes.cause || undefined,
    metadata: {
      incidentId: incident.id,
      url: incident.attributes.url,
      startedAt: incident.attributes.started_at,
      resolvedAt: incident.attributes.resolved_at,
    },
  };
}

function mapMonitorData(
  monitor: NonNullable<BetterStackWebhookPayload["data"]>
): IntegrationEvent | null {
  const status = monitor?.attributes?.status;
  if (status !== "down" && status !== "up") return null;
  const isDown = status === "down";
  const name = monitor.attributes?.pronounceable_name ?? monitor.attributes?.url ?? "Monitor";
  return {
    source: "betterstack",
    sourceEventId: `betterstack:monitor:${monitor.id}:${status}`,
    type: isDown ? "monitor.down" : "monitor.up",
    severity: isDown ? "critical" : "info",
    title: isDown ? `${name} is DOWN` : `${name} is back up`,
    body: monitor.attributes?.cause || undefined,
    metadata: { monitorId: monitor.id, url: monitor.attributes?.url, status },
  };
}

function mapMonitorStatus(payload: BetterStackWebhookPayload): IntegrationEvent | null {
  if (payload.incident) return mapIncident(payload.incident);
  if (payload.data) return mapMonitorData(payload.data);
  return null;
}

export const betterstackWebhookHandler: WebhookHandler = {
  // BetterStack uses a shared secret token in a header rather than HMAC.
  // Uses SHA-256 hashing + timingSafeEqual to prevent length-leaking timing attacks.
  async verifySignature(request: Request, secret: string): Promise<boolean> {
    const token =
      request.headers.get("x-betterstack-token") ??
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return false;
    const hashToken = createHash("sha256").update(token).digest();
    const hashSecret = createHash("sha256").update(secret).digest();
    return timingSafeEqual(hashToken, hashSecret);
  },

  async parsePayload(request: Request): Promise<IntegrationEvent[]> {
    const body = await request.clone().text();
    let payload: BetterStackWebhookPayload;
    try {
      payload = JSON.parse(body) as BetterStackWebhookPayload;
    } catch {
      return [];
    }
    const event = mapMonitorStatus(payload);
    return event ? [event] : [];
  },
};

export function generateTestPayload(_secret: string): {
  headers: Record<string, string>;
  body: string;
} {
  const payload: BetterStackWebhookPayload = {
    incident: {
      id: "test-incident-id",
      attributes: {
        name: "My API",
        url: "https://api.example.com/health",
        cause: "Connection refused",
        started_at: new Date().toISOString(),
        resolved_at: null,
      },
    },
  };
  const body = JSON.stringify(payload);
  return {
    headers: {
      "content-type": "application/json",
      "x-betterstack-token": _secret,
    },
    body,
  };
}
