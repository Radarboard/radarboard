/**
 * GitHub — Inbound webhook handler
 *
 * Signature: HMAC-SHA256 of the raw body, sent as X-Hub-Signature-256: sha256=<hex>
 * Docs: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */

import type { IntegrationEvent, WebhookHandler } from "@radarboard/integration-sdk/types";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Payload → IntegrationEvent mapping
// ---------------------------------------------------------------------------

type GitHubEventType = string;

interface GitHubWebhookPayload {
  action?: string;
  repository?: { full_name: string; name: string };
  sender?: { login: string };
  pull_request?: {
    number: number;
    title: string;
    html_url: string;
    merged: boolean;
    user: { login: string };
  };
  issue?: {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    pull_request?: unknown;
  };
  release?: {
    tag_name: string;
    name: string | null;
    html_url: string;
    author: { login: string };
    prerelease: boolean;
  };
  deployment?: {
    environment: string;
    ref: string;
    description: string | null;
  };
  deployment_status?: {
    state: "pending" | "in_progress" | "queued" | "success" | "failure" | "error";
    description: string | null;
    environment: string;
  };
  push?: never;
  ref?: string;
  commits?: unknown[];
  star?: never;
  starred_at?: string | null;
  stargazers_count?: number;
  forkee?: unknown | null;
}

function normalizeRepoKey(repo: string): string {
  return repo.trim().toLowerCase();
}

function mapPullRequest(payload: GitHubWebhookPayload, repo: string): IntegrationEvent | null {
  const pr = payload.pull_request;
  if (!pr) return null;
  const { action } = payload;
  if (action === "opened") {
    return {
      source: "github",
      sourceEventId: `github:pr:${pr.number}:opened`,
      type: "pr.opened",
      severity: "info",
      title: `PR #${pr.number} opened: ${pr.title}`,
      body: `by @${pr.user.login} · ${repo}`,
      metadata: { url: pr.html_url, repo, author: pr.user.login },
    };
  }
  if (action === "closed" && pr.merged) {
    return {
      source: "github",
      sourceEventId: `github:pr:${pr.number}:merged`,
      type: "pr.merged",
      severity: "success",
      title: `PR #${pr.number} merged: ${pr.title}`,
      body: `by @${pr.user.login} · ${repo}`,
      metadata: { url: pr.html_url, repo, author: pr.user.login },
    };
  }
  return null;
}

function mapIssue(payload: GitHubWebhookPayload, repo: string): IntegrationEvent | null {
  const issue = payload.issue;
  if (!issue || issue.pull_request) return null;
  if (payload.action !== "opened") return null;
  return {
    source: "github",
    sourceEventId: `github:issue:${issue.number}:opened`,
    type: "issue.opened",
    severity: "info",
    title: `Issue #${issue.number} opened: ${issue.title}`,
    body: `by @${issue.user.login} · ${repo}`,
    metadata: { url: issue.html_url, repo, author: issue.user.login },
  };
}

function mapRelease(payload: GitHubWebhookPayload, repo: string): IntegrationEvent | null {
  const release = payload.release;
  if (!release || payload.action !== "published") return null;
  return {
    source: "github",
    sourceEventId: `github:release:${release.tag_name}`,
    type: "version.published",
    severity: "success",
    title: `${repo} ${release.tag_name} released${release.prerelease ? " (pre-release)" : ""}`,
    body: release.name ?? undefined,
    metadata: {
      url: release.html_url,
      repo,
      tag: release.tag_name,
      prerelease: release.prerelease,
      author: release.author.login,
    },
  };
}

function mapDeploymentStatus(payload: GitHubWebhookPayload, repo: string): IntegrationEvent | null {
  const ds = payload.deployment_status;
  const dep = payload.deployment;
  if (!ds || !dep) return null;
  if (ds.state === "pending" || ds.state === "queued" || ds.state === "in_progress") return null;
  const failed = ds.state === "failure" || ds.state === "error";
  return {
    source: "github",
    sourceEventId: `github:deploy:${dep.environment}:${dep.ref}:${ds.state}`,
    type: failed ? "deploy.failed" : "deploy.succeeded",
    severity: failed ? "warning" : "success",
    title: `${repo} deploy ${failed ? "failed" : "succeeded"} on ${dep.environment}`,
    body: ds.description ?? undefined,
    metadata: {
      repo,
      environment: dep.environment,
      ref: dep.ref,
      state: ds.state,
      url: `https://github.com/${repo}`,
    },
  };
}

function mapStar(
  payload: GitHubWebhookPayload,
  repo: string,
  deliveryId: string | null
): IntegrationEvent | null {
  if (payload.action !== "created" && payload.action !== "deleted") return null;
  const count = payload.stargazers_count;
  const action = payload.action;
  const occurredAt =
    action === "created" && payload.starred_at
      ? Math.floor(new Date(payload.starred_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
  return {
    source: "github",
    sourceEventId: deliveryId ? `github:delivery:${deliveryId}` : null,
    type: action === "created" ? "star.received" : "star.removed",
    severity: action === "created" ? "success" : "info",
    title:
      action === "created"
        ? `${repo} received a new star${count ? ` (${count} total)` : ""}`
        : `${repo} lost a star${count ? ` (${count} total)` : ""}`,
    body: `from @${payload.sender?.login ?? "someone"}`,
    metadata: {
      repo,
      repoKey: normalizeRepoKey(repo),
      stargazersCount: count,
      user: payload.sender?.login,
      userLogin: payload.sender?.login,
      action,
      deliveryId,
    },
    occurredAt,
  };
}

function dispatchEvent(
  eventType: GitHubEventType,
  payload: GitHubWebhookPayload,
  deliveryId: string | null
): IntegrationEvent | null {
  const repo = payload.repository?.full_name ?? payload.repository?.name ?? "unknown";
  switch (eventType) {
    case "pull_request":
      return mapPullRequest(payload, repo);
    case "issues":
      return mapIssue(payload, repo);
    case "release":
      return mapRelease(payload, repo);
    case "deployment_status":
      return mapDeploymentStatus(payload, repo);
    case "star":
      return mapStar(payload, repo, deliveryId);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// WebhookHandler implementation
// ---------------------------------------------------------------------------

export const githubWebhookHandler: WebhookHandler = {
  async verifySignature(request: Request, secret: string): Promise<boolean> {
    const header = request.headers.get("x-hub-signature-256");
    if (!header?.startsWith("sha256=")) return false;
    const body = await request.clone().text();
    const expected = `sha256=${await hmacHex(secret, body)}`;
    // Constant-time comparison
    if (expected.length !== header.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i)!;
    }
    return mismatch === 0;
  },

  async parsePayload(request: Request): Promise<IntegrationEvent[]> {
    const eventType = request.headers.get("x-github-event") ?? "";
    const deliveryId = request.headers.get("x-github-delivery");
    const body = await request.clone().text();
    let payload: GitHubWebhookPayload;
    try {
      payload = JSON.parse(body) as GitHubWebhookPayload;
    } catch {
      return [];
    }
    const event = dispatchEvent(eventType, payload, deliveryId);
    return event ? [event] : [];
  },
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Generate a signed test payload for unit tests and the "Send test event" UI. */
export async function generateTestPayload(
  secret: string,
  eventType: GitHubEventType = "pull_request"
): Promise<{ headers: Record<string, string>; body: string }> {
  const payload: GitHubWebhookPayload = {
    action: "opened",
    repository: { full_name: "owner/test-repo", name: "test-repo" },
    sender: { login: "test-user" },
    pull_request: {
      number: 1,
      title: "Test pull request",
      html_url: "https://github.com/owner/test-repo/pull/1",
      merged: false,
      user: { login: "test-user" },
    },
  };
  const body = JSON.stringify(payload);
  const sig = `sha256=${await hmacHex(secret, body)}`;
  return {
    headers: {
      "content-type": "application/json",
      "x-github-event": eventType,
      "x-hub-signature-256": sig,
      "x-github-delivery": crypto.randomUUID(),
    },
    body,
  };
}
