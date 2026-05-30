/**
 * MCP (Model Context Protocol) types for the plugin tool system.
 *
 * These types define the wire format for MCP requests and responses,
 * independent of the transport layer (HTTP, WebSocket, etc.).
 */

/** An MCP request to invoke a tool. */
export interface McpRequest {
  /** JSON-RPC style method — always "tools/call" for tool invocations. */
  method: "tools/call" | "tools/list";
  /** Parameters for the method. */
  params?: {
    /** Namespaced tool name, e.g. "tasks__create_task". */
    name?: string;
    /** Tool input arguments (validated against the tool's Zod schema). */
    arguments?: Record<string, unknown>;
  };
}

/** An MCP response. */
export interface McpResponse {
  /** Result content for successful calls. */
  content?: Array<{ type: "text"; text: string }>;
  /** Tool listing result. */
  tools?: McpToolInfo[];
  /** Error info for failed calls. */
  error?: {
    code: string;
    message: string;
  };
}

/** Tool info returned by tools/list. */
export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
