/**
 * Linear — Inbound webhook handler
 *
 * Signature: HMAC-SHA256 of the raw body, sent as Linear-Signature: <hex>
 * Docs: https://developers.linear.app/docs/graphql/webhooks
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

interface LinearWebhookPayload {
  action: "create" | "update" | "remove";
  type: "Issue" | "Comment" | "IssueLabel" | "Cycle" | "Project" | "ProjectUpdate";
  data: {
    id: string;
    identifier?: string;
    title?: string;
    url?: string;
    state?: { name: string; type: string };
    priority?: number;
    project?: { name: string } | null;
    team?: { name: string; key: string };
    completedAt?: string | null;
    canceledAt?: string | null;
  };
  createdAt: string;
  organizationId: string;
}

function priorityToSeverity(priority: number): "critical" | "warning" | "info" | "success" {
  if (priority === 1) return "critical"; // Urgent
  if (priority === 2) return "warning"; // High
  return "info";
}

function mapLinearEvent(payload: LinearWebhookPayload): IntegrationEvent | null {
  const { action, type, data } = payload;

  if (type !== "Issue") return null;

  const identifier = data.identifier ?? data.id;
  const title = data.title ?? "Untitled";
  const projectName = data.project?.name ?? data.team?.name ?? "";

  if (action === "create") {
    return {
      source: "linear",
      sourceEventId: `linear:issue:${data.id}:created`,
      type: "issue.created",
      severity: priorityToSeverity(data.priority ?? 0),
      title: `${identifier}: ${title}`,
      body: projectName || undefined,
      metadata: {
        issueId: data.id,
        identifier,
        url: data.url,
        state: data.state?.name,
        priority: data.priority,
        project: data.project?.name,
        team: data.team?.name,
      },
    };
  }

  if (action === "update" && data.state?.type === "completed") {
    return {
      source: "linear",
      sourceEventId: `linear:issue:${data.id}:completed`,
      type: "issue.completed",
      severity: "info",
      title: `${identifier} completed: ${title}`,
      body: projectName || undefined,
      metadata: {
        issueId: data.id,
        identifier,
        url: data.url,
        project: data.project?.name,
        team: data.team?.name,
      },
    };
  }

  return null;
}

export const linearWebhookHandler: WebhookHandler = {
  async verifySignature(request: Request, secret: string): Promise<boolean> {
    const header = request.headers.get("linear-signature");
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
    let payload: LinearWebhookPayload;
    try {
      payload = JSON.parse(body) as LinearWebhookPayload;
    } catch {
      return [];
    }
    const event = mapLinearEvent(payload);
    return event ? [event] : [];
  },
};

export async function generateTestPayload(
  secret: string
): Promise<{ headers: Record<string, string>; body: string }> {
  const payload: LinearWebhookPayload = {
    action: "create",
    type: "Issue",
    data: {
      id: "test-issue-id",
      identifier: "ENG-42",
      title: "Test issue from webhook",
      url: "https://linear.app/team/issue/ENG-42",
      state: { name: "Todo", type: "unstarted" },
      priority: 2,
      project: { name: "Test Project" },
      team: { name: "Engineering", key: "ENG" },
    },
    createdAt: new Date().toISOString(),
    organizationId: "test-org-id",
  };
  const body = JSON.stringify(payload);
  const sig = await hmacHex(secret, body);
  return {
    headers: { "content-type": "application/json", "linear-signature": sig },
    body,
  };
}
