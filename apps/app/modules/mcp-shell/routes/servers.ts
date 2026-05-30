import { createLogger } from "@radarboard/logger/logger";
import {
  isMcpKey,
  type McpServerConfig,
  mcpCredentialKey,
  mcpNameFromKey,
} from "@radarboard/types/mcp-server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { parseStoredMcpServerConfig, serializeMcpServerConfig } from "@/lib/mcp-server-config";

const log = createLogger("api/mcp-servers");

const nameField = z
  .string({ error: (iss) => (iss.input === undefined ? "name is required" : iss.message) })
  .min(1, "name is required")
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => /^[a-z0-9_-]+$/.test(s), {
    message: "name may only contain lowercase letters, numbers, hyphens, and underscores",
  });

const httpUrlField = z
  .string({ error: (iss) => (iss.input === undefined ? "url is required" : iss.message) })
  .min(1, "url is required")
  .refine(
    (s) => {
      try {
        const { protocol } = new URL(s.trim());
        return protocol === "http:" || protocol === "https:";
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

const httpServerSchema = z.object({
  name: nameField,
  type: z.literal("streamable-http"),
  url: httpUrlField,
  authHeader: z.union([z.string().trim(), credentialReferenceSchema]).optional(),
  docsUrl: z.string().trim().optional(),
  enabled: z.boolean().optional().default(true),
});

const stdioServerSchema = z.object({
  name: nameField,
  type: z.literal("stdio"),
  command: stdioCommandField,
  args: z.array(z.string().trim().min(1)).optional().default([]),
  env: z.record(z.string(), z.union([z.string(), credentialReferenceSchema])).optional(),
  cwd: z.string().trim().optional(),
  docsUrl: z.string().trim().optional(),
  enabled: z.boolean().optional().default(true),
});

const McpPostSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input;
    if ("type" in input) return input;
    return { ...input, type: "streamable-http" };
  },
  z.discriminatedUnion("type", [httpServerSchema, stdioServerSchema])
);

const McpDeleteSchema = z.object({
  name: z
    .string({ error: (iss) => (iss.input === undefined ? "name is required" : iss.message) })
    .min(1, "name is required")
    .transform((s) => s.trim().toLowerCase()),
});

export async function handleListMcpServers() {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const repo = getCredentialRepo();
    const allKeys = await repo.listCredentialKeys();
    const mcpKeys = allKeys.filter(isMcpKey);

    const servers: McpServerConfig[] = [];

    await Promise.all(
      mcpKeys.map(async (key) => {
        try {
          const values = await repo.getCredential(key);
          if (!values) return;
          const config = parseStoredMcpServerConfig(mcpNameFromKey(key), values);
          if (config) servers.push(config);
        } catch (err) {
          log.warn("Failed to read MCP server credential", { key, err });
        }
      })
    );

    servers.sort((a, b) => a.name.localeCompare(b.name));

    await emitDebugEvent({
      level: "info",
      source: "api/mcp-servers",
      eventType: "mcp.servers.list.completed",
      message: "MCP server list loaded",
      requestId,
      entityType: "mcp_server",
      entityId: null,
      status: "completed",
      durationMs: Date.now() - startedAt,
      metadata: { count: servers.length },
    });
    return NextResponse.json({ servers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("no such table") || message.includes("does not exist")) {
      return NextResponse.json({ servers: [] });
    }
    log.error("GET error", { message });
    await emitDebugEvent({
      level: "error",
      source: "api/mcp-servers",
      eventType: "mcp.servers.list.failed",
      message: "Failed to list MCP servers",
      requestId,
      entityType: "mcp_server",
      entityId: null,
      status: "failed",
      durationMs: Date.now() - startedAt,
      metadata: { error: message },
    });
    return errorJson(500, "Failed to list MCP servers");
  }
}

export async function handleSaveMcpServer(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const parsed = await parseBody(request, McpPostSchema);
    if (!parsed.ok) return parsed.response;

    const server: McpServerConfig =
      parsed.data.type === "stdio"
        ? {
            name: parsed.data.name,
            type: "stdio",
            command: parsed.data.command,
            args: parsed.data.args.length > 0 ? parsed.data.args : undefined,
            env: parsed.data.env,
            cwd: parsed.data.cwd || undefined,
            docsUrl: parsed.data.docsUrl || undefined,
            enabled: parsed.data.enabled,
          }
        : {
            name: parsed.data.name,
            type: "streamable-http",
            url: parsed.data.url.trim(),
            authHeader: parsed.data.authHeader || undefined,
            docsUrl: parsed.data.docsUrl || undefined,
            enabled: parsed.data.enabled,
          };

    const { name, type } = server;
    const credentialValues = serializeMcpServerConfig(server);

    const repo = getCredentialRepo();
    await repo.setCredential(mcpCredentialKey(name), credentialValues);

    const config = parseStoredMcpServerConfig(name, credentialValues);
    await emitDebugEvent({
      level: "info",
      source: "api/mcp-servers",
      eventType: "mcp.server.saved",
      message: "MCP server saved",
      requestId,
      entityType: "mcp_server",
      entityId: name,
      status: "completed",
      durationMs: Date.now() - startedAt,
      metadata: {
        type,
        enabled: server.enabled,
        hasAuthHeader: server.type === "streamable-http" ? Boolean(server.authHeader) : false,
      },
    });
    return NextResponse.json({ success: true, server: config });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST error", { message });
    await emitDebugEvent({
      level: "error",
      source: "api/mcp-servers",
      eventType: "mcp.server.save.failed",
      message: "Failed to save MCP server",
      requestId,
      entityType: "mcp_server",
      entityId: null,
      status: "failed",
      durationMs: Date.now() - startedAt,
      metadata: { error: message },
    });
    return errorJson(500, "Failed to save MCP server");
  }
}

export async function handleDeleteMcpServer(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const parsed = await parseBody(request, McpDeleteSchema);
    if (!parsed.ok) return parsed.response;

    const { name } = parsed.data;
    const key = mcpCredentialKey(name);

    const repo = getCredentialRepo();
    const existing = await repo.getCredential(key);
    if (!existing) {
      return errorJson(404, `MCP server "${name}" not found`);
    }

    await repo.deleteCredential(key);

    await emitDebugEvent({
      level: "info",
      source: "api/mcp-servers",
      eventType: "mcp.server.deleted",
      message: "MCP server deleted",
      requestId,
      entityType: "mcp_server",
      entityId: name,
      status: "completed",
      durationMs: Date.now() - startedAt,
      metadata: {},
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("DELETE error", { message });
    await emitDebugEvent({
      level: "error",
      source: "api/mcp-servers",
      eventType: "mcp.server.delete.failed",
      message: "Failed to delete MCP server",
      requestId,
      entityType: "mcp_server",
      entityId: null,
      status: "failed",
      durationMs: Date.now() - startedAt,
      metadata: { error: message },
    });
    return errorJson(500, "Failed to delete MCP server");
  }
}
