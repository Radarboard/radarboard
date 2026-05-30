/**
 * Sentry — Inbound webhook handler
 *
 * Signature: HMAC-SHA256 of the raw body, sent as sentry-hook-signature: <hex>
 * Docs: https://docs.sentry.io/organization/integrations/integration-platform/webhooks/
 */

import type { IntegrationEvent, WebhookHandler } from "@radarboard/integration-sdk/types";

async function hmacHex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SentryWebhookPayload {
  action: string;
  data: {
    issue?: {
      id: string;
      title: string;
      culprit: string;
      level: "fatal" | "error" | "warning" | "info" | "debug";
      status: string;
      count: string;
      userCount: number;
      permalink: string;
      project: { slug: string; name: string };
    };
    error?: {
      event_id: string;
      message: string;
      level: "fatal" | "error" | "warning" | "info" | "debug";
      project: string;
    };
  };
  actor?: { name: string };
}

function levelToSeverity(level: string): "critical" | "warning" | "info" | "success" {
  if (level === "fatal" || level === "error") return "critical";
  if (level === "warning") return "warning";
  return "info";
}

function mapIssueAction(payload: SentryWebhookPayload): IntegrationEvent | null {
  const issue = payload.data.issue;
  if (!issue) return null;

  if (payload.action === "created") {
    return {
      source: "sentry",
      sourceEventId: `sentry:issue:${issue.id}:created`,
      type: "error.new",
      severity: levelToSeverity(issue.level),
      title: issue.title,
      body: `${issue.culprit} · ${issue.project.name}`,
      metadata: {
        issueId: issue.id,
        project: issue.project.slug,
        level: issue.level,
        count: issue.count,
        userCount: issue.userCount,
        url: issue.permalink,
      },
    };
  }

  if (payload.action === "resolved") {
    return {
      source: "sentry",
      sourceEventId: `sentry:issue:${issue.id}:resolved`,
      type: "error.resolved",
      severity: "info",
      title: `Resolved: ${issue.title}`,
      body: issue.project.name,
      metadata: { issueId: issue.id, project: issue.project.slug, url: issue.permalink },
    };
  }

  return null;
}

export const sentryWebhookHandler: WebhookHandler = {
  async verifySignature(request: Request, secret: string): Promise<boolean> {
    const header = request.headers.get("sentry-hook-signature");
    if (!header) return false;
    const body = await request.clone().text();
    const expected = await hmacHex(secret, body);
    if (expected.length !== header.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i)!;
    }
    return mismatch === 0;
  },

  async parsePayload(request: Request): Promise<IntegrationEvent[]> {
    const body = await request.clone().text();
    let payload: SentryWebhookPayload;
    try {
      payload = JSON.parse(body) as SentryWebhookPayload;
    } catch {
      return [];
    }
    const event = mapIssueAction(payload);
    return event ? [event] : [];
  },
};

export async function generateTestPayload(
  secret: string
): Promise<{ headers: Record<string, string>; body: string }> {
  const payload: SentryWebhookPayload = {
    action: "created",
    data: {
      issue: {
        id: "test-issue-id",
        title: "TypeError: Cannot read properties of undefined",
        culprit: "src/auth/login.ts in handleLogin",
        level: "error",
        status: "unresolved",
        count: "42",
        userCount: 8,
        permalink: "https://sentry.io/organizations/test/issues/test-issue-id/",
        project: { slug: "test-project", name: "Test Project" },
      },
    },
  };
  const body = JSON.stringify(payload);
  const sig = await hmacHex(secret, body);
  return {
    headers: { "content-type": "application/json", "sentry-hook-signature": sig },
    body,
  };
}
