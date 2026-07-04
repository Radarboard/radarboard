/**
 * Assistant action: connect an external MCP server as a data source.
 *
 * Confirm-gated (requires `confirmedByUser`) because it opens outbound network
 * egress to a user-supplied endpoint. v1 restrictions:
 *   - streamable-http transport only (stdio would run arbitrary local commands)
 *   - https, or http on localhost, only (the egress guard)
 *
 * On success the server is stored under `mcp::<name>` and enabled; the next
 * assistant turn's tool discovery picks up its tools automatically.
 */
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { mcpCredentialKey } from "@radarboard/types/mcp-server";

const NAME_PATTERN = /^[a-z0-9_-]+$/;

export interface ConnectMcpParams {
  /** Server slug (lowercase letters, numbers, - and _), e.g. "sentry". */
  name: string;
  /** streamable-http endpoint URL. */
  url: string;
  /** Optional Authorization header value, e.g. "Bearer sk_live_...". */
  authHeader?: string;
  docsUrl?: string;
  enabled?: boolean;
  /** Must be true — set only after the user approves the proposed connection. */
  confirmedByUser?: boolean;
  /** Skip the live `initialize` handshake before saving (default: verify). */
  skipVerify?: boolean;
}

export interface ConnectMcpResult {
  connected: boolean;
  name?: string;
  /** True when the action was blocked pending explicit user confirmation. */
  requiresConfirmation?: boolean;
  /** Whether the live handshake ran before saving. */
  verified?: boolean;
  /** Server name reported by the handshake, if any. */
  serverName?: string;
  error?: string;
}

/** https, or http on localhost/127.0.0.1, only. */
function validateEndpoint(url: string): { ok: true } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: `Invalid url "${url}".` };
  }
  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalhost)) {
    return { ok: true };
  }
  return { ok: false, error: "url must use https (http is only allowed for localhost)." };
}

export async function executeConnectMcp(params: ConnectMcpParams): Promise<ConnectMcpResult> {
  if (!params.confirmedByUser) {
    return {
      connected: false,
      requiresConfirmation: true,
      error:
        "Connecting an external MCP server needs explicit user confirmation. Present the server (name, url, whether it needs a token) and re-call with confirmedByUser: true once approved.",
    };
  }

  const name = params.name?.trim().toLowerCase() ?? "";
  if (!NAME_PATTERN.test(name)) {
    return {
      connected: false,
      error: `Invalid name "${params.name}" — use lowercase letters, numbers, - and _.`,
    };
  }

  const endpoint = validateEndpoint(params.url ?? "");
  if (!endpoint.ok) return { connected: false, error: endpoint.error };

  const url = params.url.trim();
  const authHeader = params.authHeader?.trim() || undefined;

  // Handshake the server before persisting, so a bad URL/token fails loudly
  // instead of silently saving a broken connection.
  let verified = false;
  let serverName: string | undefined;
  if (!params.skipVerify) {
    const { verifyHttpMcpConnection } = await import("@/lib/mcp/verify-http-mcp");
    const check = await verifyHttpMcpConnection(url, authHeader);
    if (!check.ok) {
      return {
        connected: false,
        name,
        verified: false,
        error: `Couldn't reach the MCP server: ${check.error ?? "handshake failed"}.`,
      };
    }
    verified = true;
    serverName = check.serverName;
  }

  const server: McpServerConfig = {
    name,
    type: "streamable-http",
    url,
    authHeader,
    docsUrl: params.docsUrl?.trim() || undefined,
    enabled: params.enabled ?? true,
  };

  try {
    const { serializeMcpServerConfig } = await import("@/lib/mcp/mcp-server-config");
    const { getCredentialRepo } = await import("@/data/core/repository");
    await getCredentialRepo().setCredential(
      mcpCredentialKey(name),
      serializeMcpServerConfig(server)
    );
    return { connected: true, name, verified, serverName };
  } catch (error) {
    return {
      connected: false,
      name,
      error: error instanceof Error ? error.message : "Failed to save the MCP server.",
    };
  }
}
