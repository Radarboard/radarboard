/**
 * Vercel — Inbound webhook handler
 *
 * Signature: HMAC-SHA1 of the raw body, sent as x-vercel-signature: <hex>
 * Docs: https://vercel.com/docs/observability/webhooks-overview/webhooks-api#securing-webhooks
 */

import type { IntegrationEvent, WebhookHandler } from "@radarboard/integration-sdk/types";

async function hmacSha1Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface VercelWebhookPayload {
  type: string;
  createdAt: number;
  payload: {
    alias?: string[];
    deployment?: {
      id: string;
      name: string;
      url: string;
      meta?: Record<string, string>;
    };
    project?: { id: string; name: string };
    target?: "production" | "staging" | null;
    error?: { code: string; message: string } | null;
  };
}

function mapDeployment(event: VercelWebhookPayload): IntegrationEvent | null {
  const { type, payload, createdAt } = event;
  const dep = payload.deployment;
  const project = payload.project?.name ?? dep?.name ?? "unknown";
  const idSlug = dep?.id ?? "";
  const targetLabel = payload.target ?? "preview";
  const occurredAt = Math.floor(createdAt / 1000);
  const deploymentUrl = dep?.url ? `https://${dep.url}` : undefined;
  const baseMetadata = {
    project,
    target: targetLabel,
    deploymentId: idSlug,
    ...(deploymentUrl ? { url: deploymentUrl } : {}),
  };

  if (type === "deployment.created") {
    return {
      source: "vercel",
      sourceEventId: `vercel:deploy:${idSlug}:created`,
      type: "deploy.started",
      severity: "info",
      title: `${project} deploy started (${targetLabel})`,
      body: deploymentUrl,
      metadata: baseMetadata,
      occurredAt,
    };
  }

  if (type === "deployment.succeeded") {
    return {
      source: "vercel",
      sourceEventId: `vercel:deploy:${idSlug}:succeeded`,
      type: "deploy.succeeded",
      severity: "info",
      title: `${project} deployed successfully (${targetLabel})`,
      body: deploymentUrl,
      metadata: baseMetadata,
      occurredAt,
    };
  }

  if (type === "deployment.error" || type === "deployment.canceled") {
    return {
      source: "vercel",
      sourceEventId: `vercel:deploy:${idSlug}:${type.split(".")[1]}`,
      type: "deploy.failed",
      severity: "warning",
      title: `${project} deploy ${type === "deployment.canceled" ? "cancelled" : "failed"} (${targetLabel})`,
      body: payload.error?.message ?? undefined,
      metadata: { ...baseMetadata, error: payload.error },
      occurredAt,
    };
  }

  return null;
}

export const vercelWebhookHandler: WebhookHandler = {
  async verifySignature(request: Request, secret: string): Promise<boolean> {
    const header = request.headers.get("x-vercel-signature");
    if (!header) return false;
    const body = await request.clone().text();
    const expected = await hmacSha1Hex(secret, body);
    if (expected.length !== header.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i)!;
    }
    return mismatch === 0;
  },

  async parsePayload(request: Request): Promise<IntegrationEvent[]> {
    const body = await request.clone().text();
    let payload: VercelWebhookPayload;
    try {
      payload = JSON.parse(body) as VercelWebhookPayload;
    } catch {
      return [];
    }
    const event = mapDeployment(payload);
    return event ? [event] : [];
  },
};

export async function generateTestPayload(
  secret: string
): Promise<{ headers: Record<string, string>; body: string }> {
  const payload: VercelWebhookPayload = {
    type: "deployment.succeeded",
    createdAt: Date.now(),
    payload: {
      deployment: { id: "test-id", name: "test-project", url: "test-project.vercel.app" },
      project: { id: "prj_test", name: "test-project" },
      target: "production",
      error: null,
    },
  };
  const body = JSON.stringify(payload);
  const sig = await hmacSha1Hex(secret, body);
  return {
    headers: { "content-type": "application/json", "x-vercel-signature": sig },
    body,
  };
}
