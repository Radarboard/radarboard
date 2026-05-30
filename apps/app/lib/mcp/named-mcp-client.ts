import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getCredentialRepo } from "@/data/core/repository";
import { parseStoredMcpServerConfig, resolveMcpServerConfig } from "@/lib/mcp/mcp-server-config";

interface TextContent {
  type: "text";
  text: string;
}

const STDIO_MCP_INITIALIZE_TIMEOUT_MS = 30_000;
const MCP_TOOL_CALL_TIMEOUT_MS = 20_000;

type NamedMcpTool = {
  name: string;
  inputSchema?: Record<string, unknown> | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function withNamedMcpClient<T>(name: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const repo = getCredentialRepo();
  const values = await repo.getCredential(`mcp::${name}`);
  if (!values) {
    throw new Error(`MCP server "${name}" is not configured`);
  }

  const server = parseStoredMcpServerConfig(name, values);
  if (!server || !server.enabled) {
    throw new Error(`MCP server "${name}" is disabled`);
  }

  const resolved = await resolveMcpServerConfig(server, (key) => repo.getCredential(key));

  const transport =
    resolved.type === "stdio"
      ? new StdioClientTransport({
          command: resolved.command,
          args: resolved.args,
          env: resolved.env,
          cwd: resolved.cwd,
        })
      : new StreamableHTTPClientTransport(new URL(resolved.url), {
          requestInit: {
            headers: resolved.authHeader ? { authorization: resolved.authHeader } : undefined,
          },
        });

  const client = new Client({
    name: `radarboard-${name}`,
    version: "1.0.0",
  });

  await withTimeout(
    client.connect(transport),
    STDIO_MCP_INITIALIZE_TIMEOUT_MS,
    `MCP server "${name}" initialization`
  );

  try {
    return await withTimeout(fn(client), MCP_TOOL_CALL_TIMEOUT_MS, `MCP server "${name}" request`);
  } finally {
    await client.close();
  }
}

export async function listNamedMcpTools(name: string): Promise<NamedMcpTool[]> {
  return withNamedMcpClient(name, async (client) => {
    const result = await client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      inputSchema: (tool.inputSchema as Record<string, unknown> | undefined) ?? null,
    }));
  });
}

export async function callNamedMcpToolJson<T>(
  name: string,
  tool: string,
  args: Record<string, unknown>
): Promise<T> {
  return withNamedMcpClient(name, async (client) => {
    const result = await client.callTool({
      name: tool,
      arguments: args,
    });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;

    if (result.isError) {
      const message =
        content.find((item): item is TextContent => item.type === "text")?.text ??
        `MCP tool "${tool}" failed`;
      throw new Error(message);
    }

    const text = content.find((item): item is TextContent => item.type === "text");
    if (!text) {
      throw new Error(`MCP tool "${tool}" returned no text content`);
    }

    try {
      return JSON.parse(text.text) as T;
    } catch {
      throw new Error(`MCP tool "${tool}" returned non-JSON text content`);
    }
  });
}
