/**
 * Verify a streamable-http MCP endpoint by performing the `initialize`
 * handshake. Returns a plain result (no HTTP objects) so it can be reused by
 * both the "test connection" route and the assistant's connect-with-verify flow.
 */

const DEFAULT_TIMEOUT_MS = 8_000;

export interface VerifyMcpResult {
  ok: boolean;
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
  error?: string;
}

/** Parse an MCP initialize response body, handling both JSON and SSE framing. */
function parseInitializeResponse(text: string): { json: unknown } | { error: string } {
  let jsonText = text;
  if (text.startsWith("data:")) {
    const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) return { error: "Empty SSE response from server" };
    jsonText = dataLine.slice("data:".length).trim();
  }
  try {
    return { json: JSON.parse(jsonText) };
  } catch {
    return { error: "Server returned non-JSON response" };
  }
}

export async function verifyHttpMcpConnection(
  url: string,
  authHeader?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<VerifyMcpResult> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json, text/event-stream");
  const trimmedAuthHeader = authHeader?.trim();
  if (trimmedAuthHeader) headers.set("Authorization", trimmedAuthHeader);

  const initializePayload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "radarboard-verify", version: "1.0.0" },
    },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: initializePayload,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `Server returned HTTP ${response.status}` };
    }

    const parsed = parseInitializeResponse(await response.text());
    if ("error" in parsed) return { ok: false, error: parsed.error };

    const result = parsed.json as {
      result?: { serverInfo?: { name?: string; version?: string }; protocolVersion?: string };
      error?: { message?: string };
    };
    if (result.error) {
      return { ok: false, error: result.error.message ?? "MCP server returned an error" };
    }

    return {
      ok: true,
      serverName: result.result?.serverInfo?.name,
      serverVersion: result.result?.serverInfo?.version,
      protocolVersion: result.result?.protocolVersion,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: `Connection timed out after ${timeoutMs / 1000}s` };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}
