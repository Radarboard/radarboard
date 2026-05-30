import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import "@/lib/extensions/runtime/integrations-init";
import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { z } from "zod";
import { runTool } from "@/app/api/mcp/tools";
import { getLlmRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { getAppUrl, verifyMcpToken } from "@/lib/mcp-oauth";
import { buildServerPluginAPI, getResolvedPluginTools } from "@/lib/plugin-tool-bridge";

function getToolShape(schema: z.ZodType): z.ZodRawShape {
  if (schema instanceof z.ZodObject) {
    return schema.shape;
  }
  throw new Error("Integration MCP tools must use z.object(...) parameter schemas");
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^[Bb]earer\s+(.+)$/);
  return match?.[1] ?? null;
}

async function authenticate(request: Request): Promise<Response | null> {
  const token = extractToken(request);
  if (!token) {
    return errorJson(401, "unauthorized");
  }
  const valid = await verifyMcpToken(token);
  if (!valid) {
    return errorJson(401, "invalid_token");
  }
  return null;
}

async function buildMcpServer(): Promise<McpServer> {
  const server = new McpServer({ name: "radarboard", version: "1.0.0" });

  for (const descriptor of getAllIntegrations()) {
    for (const tool of descriptor.mcpTools ?? []) {
      server.tool(tool.name, tool.description, getToolShape(tool.parameters), async (args) =>
        runTool(tool.name, args as Record<string, unknown>)
      );
    }
  }

  server.tool(
    "get_notifications",
    "Query the Radarboard notification feed. Returns recent events and digests with severity, source, and read status.",
    {
      source: z.string().optional().describe("Filter by integration (e.g. 'github', 'sentry')"),
      severity: z
        .enum(["critical", "warning", "info"])
        .optional()
        .describe("Minimum severity filter"),
      status: z.enum(["all", "unread", "read"]).default("all").describe("Read status filter"),
      limit: z.number().int().min(1).max(100).default(20).describe("Number of results"),
    },
    async ({ source, severity, status, limit }) =>
      runTool("notifications", {
        ...(source ? { source } : {}),
        ...(severity ? { severity } : {}),
        status,
        limit: String(limit),
      })
  );

  server.tool("get_unread_count", "Get the number of unread notifications.", {}, async () =>
    runTool("notifications_count", {})
  );

  server.tool(
    "acknowledge_notification",
    "Mark a specific notification as read by its delivery ID.",
    { id: z.string().min(1).describe("The delivery ID of the notification to acknowledge") },
    async ({ id }) => runTool("notifications_mark_read", { id })
  );

  server.tool(
    "acknowledge_all",
    "Mark all notifications as read, optionally filtering by source.",
    { source: z.string().optional().describe("Only acknowledge notifications from this source") },
    async ({ source }) => runTool("notifications_mark_read", { ...(source ? { source } : {}) })
  );

  server.tool(
    "get_notification_summary",
    "Get an AI-optimised summary of recent notification activity — counts by severity, unread count, and highlights per integration.",
    { hours: z.number().int().min(1).max(168).default(24).describe("Look-back window in hours") },
    async ({ hours }) => runTool("notifications_summary", { hours: String(hours) })
  );

  server.tool(
    "get_debug_events",
    "Query durable internal debug events across chat, plugins, notifications, and MCP tools.",
    {
      source: z.string().optional().describe("Filter by event source"),
      eventType: z.string().optional().describe("Filter by event type"),
      projectSlug: z.string().optional().describe("Filter by project slug"),
      level: z.enum(["debug", "info", "warn", "error"]).optional().describe("Filter by level"),
      traceId: z.string().optional().describe("Filter by trace id"),
      conversationId: z.string().optional().describe("Filter by chat conversation id"),
      search: z.string().optional().describe("Free-text search across message, source, and type"),
      limit: z.number().int().min(1).max(200).default(50).describe("Number of results"),
    },
    async ({ source, eventType, projectSlug, level, traceId, conversationId, search, limit }) =>
      runTool("debug_events", {
        ...(source ? { source } : {}),
        ...(eventType ? { eventType } : {}),
        ...(projectSlug ? { projectSlug } : {}),
        ...(level ? { level } : {}),
        ...(traceId ? { traceId } : {}),
        ...(conversationId ? { conversationId } : {}),
        ...(search ? { search } : {}),
        limit: String(limit),
      })
  );

  server.tool(
    "list_artifacts",
    "List saved assistant workflow artifacts, optionally filtered by project, mode, or conversation.",
    {
      projectSlug: z.string().optional().describe("Only artifacts for this project"),
      mode: z
        .enum(["explore", "plan", "review", "qa"])
        .optional()
        .describe("Only artifacts from this workflow mode"),
      sourceConversationId: z.string().optional().describe("Only artifacts from this conversation"),
      limit: z.number().int().min(1).max(100).default(10).describe("Number of results"),
    },
    async ({ projectSlug, mode, sourceConversationId, limit }) => {
      const repo = getLlmRepo();
      const artifacts = await repo.listArtifacts({
        ...(projectSlug ? { projectSlug } : {}),
        ...(mode ? { mode } : {}),
        ...(sourceConversationId ? { sourceConversationId } : {}),
        limit,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ artifacts }, null, 2) }],
      };
    }
  );

  server.tool(
    "get_artifact",
    "Get a saved assistant workflow artifact by id.",
    { artifactId: z.string().min(1).describe("Artifact id") },
    async ({ artifactId }) => {
      const repo = getLlmRepo();
      const artifact = await repo.getArtifact(artifactId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ artifact }, null, 2) }],
      };
    }
  );

  server.tool(
    "save_artifact",
    "Create or update a saved assistant workflow artifact.",
    {
      id: z.string().optional().describe("Existing artifact id to update"),
      projectSlug: z.string().nullable().default(null).describe("Artifact project slug, or null"),
      mode: z.enum(["explore", "plan", "review", "qa"]).describe("Workflow mode"),
      title: z.string().min(1).describe("Artifact title"),
      summary: z.string().min(1).describe("Artifact summary"),
      body: z.string().min(1).describe("Full artifact body"),
      contentType: z
        .enum(["markdown", "html", "mermaid"])
        .default("markdown")
        .describe("How to render the artifact body"),
      status: z
        .enum(["draft", "completed", "blocked", "needs_input", "failed"])
        .default("completed")
        .describe("Artifact status"),
      sourceConversationId: z.string().nullable().default(null).describe("Origin conversation id"),
      nextMode: z
        .enum(["default", "explore", "plan", "review", "qa"])
        .nullable()
        .default(null)
        .describe("Recommended next mode"),
      nextReason: z.string().nullable().default(null).describe("Why that next mode is recommended"),
    },
    async ({
      id,
      projectSlug,
      mode,
      title,
      summary,
      body,
      contentType,
      status,
      sourceConversationId,
      nextMode,
      nextReason,
    }) => {
      const repo = getLlmRepo();
      const artifactId = id ?? crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await repo.upsertArtifact({
        id: artifactId,
        projectSlug,
        mode,
        title,
        summary,
        body,
        contentType,
        status,
        sourceConversationId,
        createdAt,
        nextMode,
        nextReason,
        evidenceRefs: [],
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ saved: true, artifactId }, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "snooze_source",
    "Temporarily mute notifications from a specific integration.",
    {
      source: z.string().min(1).describe("Integration to snooze (e.g. 'github')"),
      minutes: z.number().int().min(5).max(1440).default(60).describe("Duration in minutes"),
    },
    async ({ source, minutes }) => {
      const base = getAppUrl();
      const res = await fetch(`${base}/api/notifications/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source,
          enabled: false,
          preset: "all",
          digestWindow: 300,
          channels: ["in_app"],
          quietHours: null,
        }),
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ snoozed: source, minutes, ok: res.ok }) },
        ],
      };
    }
  );

  for (const entry of await getResolvedPluginTools()) {
    const api = buildServerPluginAPI(entry.pluginId);
    server.tool(
      entry.namespacedName,
      entry.tool.description,
      entry.tool.parameters instanceof z.ZodObject
        ? (entry.tool.parameters as z.ZodObject<Record<string, z.ZodType>>).shape
        : {},
      async (params) => {
        const result = await entry.tool.execute(params, api);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );
  }

  return server;
}

export async function handleMcpServer(request: Request): Promise<Response> {
  const authError = await authenticate(request);
  if (authError) return authError;

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = await buildMcpServer();
  await server.connect(transport);

  return transport.handleRequest(request);
}
