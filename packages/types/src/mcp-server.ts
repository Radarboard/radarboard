/**
 * MCP (Model Context Protocol) server configuration types.
 *
 * MCP servers are stored in the credential store under keys prefixed `mcp::<name>`.
 * Both remote streamable HTTP servers and local stdio servers are supported.
 */

export type McpTransportType = "streamable-http" | "stdio";

export interface McpCredentialReference {
  /** Resolve this value from a saved integration credential at runtime. */
  type: "integration-credential";
  /** Credential record key, e.g. "raindrop". */
  credentialKey: string;
  /** Field within that credential record, e.g. "accessToken". */
  field: string;
  /** Optional template applied after resolution. Use "{{value}}" as the placeholder. */
  template?: string;
}

export type McpSecretValue = string | McpCredentialReference;

interface McpServerBase {
  /** Unique slug used as the storage key suffix (e.g. "astro" → stored as "mcp::astro"). */
  name: string;
  /** Optional URL to the server's documentation. */
  docsUrl?: string;
  /** Whether this server is active. Disabled servers are stored but not used. */
  enabled: boolean;
}

/** MCP server reachable over a streamable HTTP endpoint. */
export interface StreamableHttpMcpServerConfig extends McpServerBase {
  /** Transport type. */
  type: "streamable-http";
  /** Full URL of the MCP endpoint, e.g. "http://127.0.0.1:8089/mcp". */
  url: string;
  /**
   * Optional Authorization header value, e.g. "Bearer <token>".
   * Omit for unauthenticated servers.
   */
  authHeader?: McpSecretValue;
}

/** MCP server launched locally as a child process over stdio. */
export interface StdioMcpServerConfig extends McpServerBase {
  /** Transport type. */
  type: "stdio";
  /** Executable to run, e.g. "npx". */
  command: string;
  /** Optional command line arguments, e.g. ["-y", "openpanel-mcp-server"]. */
  args?: string[];
  /** Optional environment variables passed to the child process. */
  env?: Record<string, McpSecretValue>;
  /** Optional working directory for the child process. */
  cwd?: string;
}

/** A single configured MCP server. */
export type McpServerConfig = StreamableHttpMcpServerConfig | StdioMcpServerConfig;

export interface ResolvedStreamableHttpMcpServerConfig
  extends Omit<StreamableHttpMcpServerConfig, "authHeader"> {
  authHeader?: string;
}

export interface ResolvedStdioMcpServerConfig extends Omit<StdioMcpServerConfig, "env"> {
  env?: Record<string, string>;
}

export type ResolvedMcpServerConfig =
  | ResolvedStreamableHttpMcpServerConfig
  | ResolvedStdioMcpServerConfig;

/** Shape stored in the credential table (values record for one MCP server). */
export type McpServerCredentialValues =
  | {
      type?: "streamable-http";
      url: string;
      authHeader?: string;
      authHeaderRef?: string;
      docsUrl?: string;
      enabled: "true" | "false";
    }
  | {
      type: "stdio";
      command: string;
      args?: string;
      env?: string;
      cwd?: string;
      docsUrl?: string;
      enabled: "true" | "false";
    };

/** Prefix used for all MCP server credential keys. */
export const MCP_KEY_PREFIX = "mcp::";

/** Build the credential storage key for an MCP server name. */
export function mcpCredentialKey(name: string): string {
  return `${MCP_KEY_PREFIX}${name}`;
}

/** Check if a credential key belongs to an MCP server. */
export function isMcpKey(key: string): boolean {
  return key.startsWith(MCP_KEY_PREFIX);
}

/** Extract the server name from an MCP credential key. */
export function mcpNameFromKey(key: string): string {
  return key.slice(MCP_KEY_PREFIX.length);
}

export function isMcpCredentialReference(value: unknown): value is McpCredentialReference {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as McpCredentialReference).type === "integration-credential" &&
    typeof (value as McpCredentialReference).credentialKey === "string" &&
    typeof (value as McpCredentialReference).field === "string"
  );
}
