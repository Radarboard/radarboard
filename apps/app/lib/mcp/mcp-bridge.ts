/**
 * MCP Bridge — auto-discovers configured MCP servers and exposes them as AI tools.
 *
 * Uses @ai-sdk/mcp to connect to MCP servers and extract their tool definitions.
 * All enabled MCP servers are automatically available to the LLM.
 */
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ResolvedMcpServerConfig } from "@radarboard/types/mcp-server";
import { isMcpKey, mcpNameFromKey } from "@radarboard/types/mcp-server";
import { getCredentialRepo } from "@/data/core/repository";
import {
  normalizeStdioCommand,
  parseStoredMcpServerConfig,
  resolveMcpServerConfig,
} from "@/lib/mcp/mcp-server-config";

// ---------------------------------------------------------------------------
// Discovery — find all enabled MCP servers from the credential store
// ---------------------------------------------------------------------------

/** Discover all enabled MCP servers from the credential store. */
export async function discoverMcpServers(): Promise<ResolvedMcpServerConfig[]> {
  const repo = getCredentialRepo();
  const allKeys = await repo.listCredentialKeys();
  const mcpKeys = allKeys.filter(isMcpKey);

  const servers: ResolvedMcpServerConfig[] = [];

  for (const key of mcpKeys) {
    const cred = await repo.getCredential(key);
    if (!cred) continue;

    const server = parseStoredMcpServerConfig(mcpNameFromKey(key), cred);
    if (!server || !server.enabled) continue;

    servers.push(
      await resolveMcpServerConfig(server, (credentialKey) => repo.getCredential(credentialKey))
    );
  }

  return servers;
}

// ---------------------------------------------------------------------------
// Transport config — build the MCP transport for @ai-sdk/mcp
// ---------------------------------------------------------------------------

type McpTransportConfig = Parameters<typeof createMCPClient>[0]["transport"];

/** Build transport config for an MCP server. */
export function buildMcpServerConfig(server: ResolvedMcpServerConfig): McpTransportConfig {
  if (server.type === "stdio") {
    const normalized = normalizeStdioCommand(server.command, server.args);
    return new StdioClientTransport({
      command: normalized.command,
      args: normalized.args,
      env: server.env,
      cwd: server.cwd,
    });
  }

  return new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: {
      // biome-ignore lint/style/useNamingConvention: HTTP header name
      headers: server.authHeader ? { Authorization: server.authHeader } : undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Tool extraction — connect to MCP server and extract tools
// ---------------------------------------------------------------------------

/**
 * Connect to all enabled MCP servers and extract their tools as AI SDK tool objects.
 * Returns a flat map of tool name → tool definition.
 * Prefixes tool names with the server name to avoid collisions (e.g. "astro__search_keywords").
 */
export async function buildMcpTools(): Promise<Record<string, unknown>> {
  const servers = await discoverMcpServers();
  if (servers.length === 0) return {};

  // biome-ignore lint/suspicious/noExplicitAny: MCP tools have varying schemas
  const allTools: Record<string, any> = {};

  for (const server of servers) {
    try {
      const transport = buildMcpServerConfig(server);
      const client = await createMCPClient({ transport });
      const tools = await client.tools();

      // Prefix each tool name with server name to avoid collisions
      for (const [toolName, toolDef] of Object.entries(tools)) {
        allTools[`${server.name}__${toolName}`] = toolDef;
      }

      await client.close();
    } catch {
      // MCP server unavailable — skip silently, non-fatal
    }
  }

  return allTools;
}
