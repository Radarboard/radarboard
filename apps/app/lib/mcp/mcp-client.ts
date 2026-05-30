/**
 * Lightweight MCP client for calling Streamable HTTP MCP servers from Next.js
 * API routes.
 *
 * Does NOT use the @modelcontextprotocol/sdk — we implement the minimal
 * JSON-RPC over HTTP subset needed to call tools. This avoids a heavyweight
 * dependency and keeps the server-side bundle small.
 *
 * Session lifecycle:
 *   1. POST /mcp  { method: "initialize" }  → get Mcp-Session-Id header
 *   2. POST /mcp  { method: "tools/call" }  with that session header
 *
 * Each McpClient instance manages one persistent session per server URL.
 * Singletons are cached per process (Next.js server).
 */

const INIT_TIMEOUT_MS = 10_000;
const CALL_TIMEOUT_MS = 30_000;

export interface McpToolCallResult {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
}

export class McpClientError extends Error {
  constructor(
    message: string,
    public readonly code?: number
  ) {
    super(message);
    this.name = "McpClientError";
  }
}

export class McpClient {
  private sessionId: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly authHeader?: string
  ) {}

  private buildHeaders(): Record<string, string> {
    const contentType = "Content-Type";
    const accept = "Accept";
    const authorization = "Authorization";
    const sessionHeader = "mcp-session-id";
    const h: Record<string, string> = {};
    h[contentType] = "application/json";
    h[accept] = "application/json, text/event-stream";
    if (this.authHeader) h[authorization] = this.authHeader;
    if (this.sessionId) h[sessionHeader] = this.sessionId;
    return h;
  }

  private async fetchWithTimeout(body: unknown, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(this.url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }

  private parseResponseText(text: string): unknown {
    // Handle SSE envelope: "data: {...}\n\n"
    if (text.trimStart().startsWith("data:")) {
      const line = text.split("\n").find((l) => l.startsWith("data:"));
      if (line) return JSON.parse(line.slice("data:".length).trim());
    }
    return JSON.parse(text);
  }

  private async initialize(): Promise<void> {
    const res = await this.fetchWithTimeout(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "radarboard", version: "1.0.0" },
        },
      },
      INIT_TIMEOUT_MS
    );

    if (!res.ok) throw new McpClientError(`MCP initialize failed: HTTP ${res.status}`, res.status);

    // Grab session ID from response headers (Streamable HTTP)
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;

    // Drain the body to ensure the connection is established
    await res.text();
  }

  /** Ensure session is initialized (idempotent). */
  private async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    if (!this.initPromise) {
      this.initPromise = this.initialize().catch((err) => {
        this.initPromise = null; // allow retry on next call
        throw err;
      });
    }
    await this.initPromise;
  }

  /**
   * Call an MCP tool and return parsed result content.
   * Throws McpClientError on protocol or transport errors.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.ensureSession();

    const res = await this.fetchWithTimeout(
      {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      },
      CALL_TIMEOUT_MS
    );

    if (!res.ok) throw new McpClientError(`MCP tools/call failed: HTTP ${res.status}`, res.status);

    const text = await res.text();
    const parsed = this.parseResponseText(text) as {
      result?: McpToolCallResult;
      error?: { message: string; code?: number };
    };

    if (parsed.error) {
      throw new McpClientError(parsed.error.message ?? "MCP error", parsed.error.code);
    }
    if (!parsed.result) {
      throw new McpClientError("MCP response missing result");
    }

    return parsed.result;
  }

  /**
   * Convenience: call a tool and parse the first text content as JSON.
   */
  async callToolJson<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await this.callTool(name, args);
    if (result.isError) {
      const msg = result.content.find((c) => c.type === "text")?.text ?? "MCP tool error";
      throw new McpClientError(msg);
    }
    const textContent = result.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new McpClientError("MCP tool returned no text content");
    }
    return JSON.parse(textContent.text) as T;
  }
}

// ---------------------------------------------------------------------------
// Per-process singleton registry
// ---------------------------------------------------------------------------

const _clients = new Map<string, McpClient>();

/**
 * Get or create a cached McpClient for the given URL.
 * Pass a new authHeader to replace the cached client.
 */
export function getMcpClient(url: string, authHeader?: string): McpClient {
  const key = `${url}::${authHeader ?? ""}`;
  if (!_clients.has(key)) {
    _clients.set(key, new McpClient(url, authHeader));
  }
  return _clients.get(key) as McpClient;
}

/** Reset all cached clients (useful in tests). */
export function resetMcpClients(): void {
  _clients.clear();
}
