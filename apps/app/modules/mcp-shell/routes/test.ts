import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createLogger } from "@radarboard/logger/logger";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import {
  formatStdioLaunchError,
  normalizeStdioCommand,
  resolveMcpServerConfig,
} from "@/lib/mcp-server-config";

const log = createLogger("api/mcp-servers/test");

const HTTP_MCP_INITIALIZE_TIMEOUT_MS = 8_000;
const STDIO_MCP_INITIALIZE_TIMEOUT_MS = 30_000;

const httpUrlField = z
  .string({ error: (iss) => (iss.input === undefined ? "url is required" : iss.message) })
  .min(1, "url is required")
  .refine(
    (value) => {
      try {
        const parsed = new URL(value.trim());
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "url must use http or https protocol" }
  );

const stdioCommandField = z
  .string({ error: (iss) => (iss.input === undefined ? "command is required" : iss.message) })
  .trim()
  .min(1, "command is required");

const credentialReferenceSchema = z.object({
  type: z.literal("integration-credential"),
  credentialKey: z.string().trim().min(1, "credentialKey is required"),
  field: z.string().trim().min(1, "field is required"),
  template: z.string().optional(),
});

const TestBodySchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input;
    if ("type" in input) return input;
    return { ...input, type: "streamable-http" };
  },
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("streamable-http"),
      url: httpUrlField,
      authHeader: z.union([z.string().trim(), credentialReferenceSchema]).optional(),
    }),
    z.object({
      type: z.literal("stdio"),
      command: stdioCommandField,
      args: z.array(z.string().trim().min(1)).optional().default([]),
      env: z.record(z.string(), z.union([z.string(), credentialReferenceSchema])).optional(),
      cwd: z.string().trim().optional(),
    }),
  ])
);

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Connection timed out after ${timeoutMs / 1000}s`));
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

async function testHttpConnection(url: string, authHeader?: string) {
  const trimmedAuthHeader = authHeader?.trim();
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json, text/event-stream");
  if (trimmedAuthHeader) {
    headers.set("Authorization", trimmedAuthHeader);
  }

  const initializePayload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "radarboard-test", version: "1.0.0" },
    },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_MCP_INITIALIZE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: initializePayload,
      signal: controller.signal,
    });

    if (!response.ok) {
      return errorJson(500, `Server returned HTTP ${response.status}`, { ok: false });
    }

    const parsed = parseInitializeResponse(await response.text());
    if ("error" in parsed) {
      return errorJson(500, parsed.error, { ok: false });
    }

    const result = parsed.json as {
      result?: { serverInfo?: { name?: string; version?: string }; protocolVersion?: string };
      error?: { message?: string };
    };

    if (result.error) {
      return errorJson(500, result.error.message ?? "MCP server returned an error", { ok: false });
    }

    return NextResponse.json({
      ok: true,
      serverName: result.result?.serverInfo?.name,
      serverVersion: result.result?.serverInfo?.version,
      protocolVersion: result.result?.protocolVersion,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return errorJson(
        500,
        `Connection timed out after ${HTTP_MCP_INITIALIZE_TIMEOUT_MS / 1000}s`,
        { ok: false }
      );
    }
    const message = err instanceof Error ? err.message : "Connection failed";
    log.error("MCP HTTP connection test failed", { error: err });
    return errorJson(500, message, { ok: false });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testStdioConnection(input: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}) {
  const normalized = normalizeStdioCommand(input.command, input.args);
  const transport = new StdioClientTransport({
    command: normalized.command,
    args: normalized.args,
    env: input.env,
    cwd: input.cwd || undefined,
    stderr: "pipe",
  });

  let stderrOutput = "";
  const stderrStream = transport.stderr;
  if (stderrStream) {
    stderrStream.on("data", (chunk) => {
      stderrOutput += chunk.toString();
    });
  }

  const client = new Client({ name: "radarboard-test", version: "1.0.0" });

  try {
    await withTimeout(client.connect(transport), STDIO_MCP_INITIALIZE_TIMEOUT_MS);

    const serverInfo = client.getServerVersion();
    return NextResponse.json({
      ok: true,
      serverName: serverInfo?.name,
      serverVersion: serverInfo?.version,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    const stderrMessage = stderrOutput.trim();
    log.error("MCP stdio connection test failed", { error: err });
    return errorJson(
      500,
      formatStdioLaunchError({
        command: normalized.command,
        args: normalized.args,
        message,
        stderr: stderrMessage,
      }),
      { ok: false }
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function handleTestMcpServer(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, "Invalid JSON body", { ok: false });
  }

  const parsed = TestBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorJson(400, issue?.message ?? "Invalid request body", { ok: false });
  }

  const repo = getCredentialRepo();

  const baseServer: McpServerConfig =
    parsed.data.type === "stdio"
      ? {
          name: "test",
          enabled: true,
          type: "stdio",
          command: parsed.data.command,
          args: parsed.data.args,
          env: parsed.data.env,
          cwd: parsed.data.cwd || undefined,
        }
      : {
          name: "test",
          enabled: true,
          type: "streamable-http",
          url: parsed.data.url.trim(),
          authHeader: parsed.data.authHeader,
        };

  let resolved: Awaited<ReturnType<typeof resolveMcpServerConfig>>;
  try {
    resolved = await resolveMcpServerConfig(baseServer, (key) => repo.getCredential(key));
  } catch (error) {
    log.error("Failed to resolve MCP credentials", { error });
    return errorJson(
      400,
      error instanceof Error ? error.message : "Failed to resolve MCP credentials",
      { ok: false }
    );
  }

  if (resolved.type === "stdio") {
    return testStdioConnection(resolved);
  }

  return testHttpConnection(resolved.url.trim(), resolved.authHeader);
}
