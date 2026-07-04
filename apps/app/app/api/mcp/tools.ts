/**
 * MCP tool runner — calls existing internal API routes so the MCP server
 * reuses all credential resolution, caching, and error handling already in place.
 */
import "@/lib/extensions/runtime/integrations-init";

import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { integrationRoute } from "@radarboard/integration-sdk/routes";
import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { createLogger } from "@radarboard/logger/logger";
import { API_ROUTES, type IntegrationActionRoute } from "@radarboard/types/api-routes";
import { emitDebugEvent } from "@/lib/debug-events";

const log = createLogger("api/mcp/tools");

import { getAppUrl } from "@/lib/mcp-oauth";

type ToolResult = { content: [{ type: "text"; text: string }] };

type McpToolRoute =
  | typeof API_ROUTES.notifications
  | typeof API_ROUTES.debugEvents
  | IntegrationActionRoute;

async function callApi(path: McpToolRoute, params?: Record<string, string>): Promise<unknown> {
  const base = getAppUrl();
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json();
}

function toResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function handleNotificationsList(args: Record<string, string>): Promise<ToolResult> {
  const params: Record<string, string> = {};
  if (args.source) params.source = args.source;
  if (args.severity) params.severity = args.severity;
  if (args.status) params.status = args.status;
  if (args.limit) params.limit = args.limit;
  return callApi(API_ROUTES.notifications, params).then(toResult);
}

async function handleNotificationsMarkRead(args: Record<string, string>): Promise<ToolResult> {
  const base = getAppUrl();
  const res = await fetch(`${base}${API_ROUTES.notifications}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      args.id
        ? { action: "mark_read", id: args.id }
        : { action: "mark_all_read", source: args.source }
    ),
  });
  return toResult(await res.json());
}

async function handleNotificationsSummary(args: Record<string, string>): Promise<ToolResult> {
  const data = (await callApi(API_ROUTES.notifications, {
    limit: "100",
    status: "all",
  })) as {
    items?: Array<{
      severity: string;
      source: string;
      title: string;
      occurredAt: number;
      status: string;
    }>;
    unreadCount?: number;
  };
  const items = data.items ?? [];
  const now = Math.floor(Date.now() / 1000);
  const since = now - (args.hours ? Number(args.hours) * 3600 : 86400);
  const recent = items.filter((i) => i.occurredAt >= since);
  const critical = recent.filter((i) => i.severity === "critical");
  const warnings = recent.filter((i) => i.severity === "warning");
  const info = recent.filter((i) => i.severity === "info");
  const sources = [...new Set(recent.map((i) => i.source))];
  return toResult({
    period: `last_${args.hours ?? 24}h`,
    summary: `${critical.length} critical, ${warnings.length} warnings, ${info.length} info events across ${sources.length} integrations`,
    unreadCount: data.unreadCount ?? 0,
    critical: critical.slice(0, 5).map((i) => ({
      title: i.title,
      source: i.source,
      acknowledged: i.status === "read",
    })),
    warnings: warnings.slice(0, 5).map((i) => ({ title: i.title, source: i.source })),
    highlights: sources
      .map((src) => {
        const srcItems = recent.filter((i) => i.source === src);
        return `${src}: ${srcItems.length} event${srcItems.length > 1 ? "s" : ""}`;
      })
      .slice(0, 6),
  });
}

function handleNotificationTools(name: string, args: Record<string, string>): Promise<ToolResult> {
  if (name === "notifications") return handleNotificationsList(args);
  if (name === "notifications_count")
    return callApi(API_ROUTES.notifications, { countOnly: "1" }).then(toResult);
  if (name === "notifications_mark_read") return handleNotificationsMarkRead(args);
  if (name === "notifications_summary") return handleNotificationsSummary(args);
  throw new Error(`Unknown notification tool: ${name}`);
}

function pickDefinedArgs(args: Record<string, string>, keys: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of keys) {
    if (args[key]) params[key] = args[key];
  }
  return params;
}

type RegisteredIntegrationTool = {
  integrationId: string;
  tool: IntegrationMcpTool;
};

function findRegisteredIntegrationTool(name: string): RegisteredIntegrationTool | null {
  for (const descriptor of getAllIntegrations()) {
    const tool = descriptor.mcpTools?.find((entry) => entry.name === name);
    if (tool) {
      return {
        integrationId: descriptor.id,
        tool,
      };
    }
  }
  return null;
}

function normalizeStringParams(args: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = String(value);
  }
  return params;
}

async function handleRegisteredIntegrationTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const registered = findRegisteredIntegrationTool(name);
  if (!registered) {
    throw new Error(`Unknown integration MCP tool: ${name}`);
  }

  const { integrationId, tool } = registered;

  if (tool.route) {
    const routeIntegrationId = tool.route.integrationId ?? integrationId;
    const params = tool.route.buildParams?.(args) ?? normalizeStringParams(args);
    const path = integrationRoute(routeIntegrationId, tool.route.action);
    return toResult(await callApi(path, params));
  }

  if (tool.execute) {
    return toResult(await tool.execute(args));
  }

  throw new Error(`Integration MCP tool ${name} has no route or execute handler`);
}

const LADDER_TOOLS = new Set([
  "find_integration_options",
  "plan_integration_setup",
  "create_rest_integration",
  "connect_mcp_server",
  "show_rest_data",
  "list_user_integrations",
  "remove_rest_integration",
]);

/**
 * Integration "ladder" tools — the same discover → plan → create → visualize
 * flow the in-app assistant uses, delegating to the exact same executors so an
 * external MCP client can build integrations + dashboard widgets.
 */
async function handleLadderTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "find_integration_options": {
      const { executeFindOptions } = await import("@/lib/ai-actions/integrations/find-options");
      return toResult(await executeFindOptions(args as { service: string }));
    }
    case "plan_integration_setup": {
      const { executePlanSetup } = await import("@/lib/ai-actions/integrations/plan-setup");
      return toResult(await executePlanSetup(args as { service: string }));
    }
    case "create_rest_integration": {
      const { executeCreateIntegration } = await import(
        "@/lib/ai-actions/dashboard/connect-integration"
      );
      return toResult(
        await executeCreateIntegration(
          args as unknown as Parameters<typeof executeCreateIntegration>[0]
        )
      );
    }
    case "connect_mcp_server": {
      const { executeConnectMcp } = await import("@/lib/ai-actions/integrations/connect-mcp");
      return toResult(
        await executeConnectMcp(args as unknown as Parameters<typeof executeConnectMcp>[0])
      );
    }
    case "show_rest_data": {
      const { executePlaceRestWidget } = await import(
        "@/lib/ai-actions/integrations/place-rest-widget"
      );
      return toResult(
        await executePlaceRestWidget(
          args as unknown as Parameters<typeof executePlaceRestWidget>[0]
        )
      );
    }
    case "list_user_integrations": {
      const { executeListUserIntegrations } = await import(
        "@/lib/ai-actions/dashboard/connect-integration"
      );
      return toResult(await executeListUserIntegrations());
    }
    case "remove_rest_integration": {
      const { executeRemoveIntegration } = await import(
        "@/lib/ai-actions/dashboard/connect-integration"
      );
      return toResult(await executeRemoveIntegration(args as { id: string }));
    }
    default:
      throw new Error(`Unknown ladder tool: ${name}`);
  }
}

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name.startsWith("notifications")) {
    return handleNotificationTools(name, args as Record<string, string>);
  }

  if (LADDER_TOOLS.has(name)) {
    return handleLadderTool(name, args);
  }

  if (name === "debug_events") {
    const params = pickDefinedArgs(args as Record<string, string>, [
      "source",
      "eventType",
      "projectSlug",
      "level",
      "traceId",
      "conversationId",
      "search",
      "limit",
    ]);
    return toResult(await callApi(API_ROUTES.debugEvents, params));
  }

  return handleRegisteredIntegrationTool(name, args);
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let succeeded = false;
  await emitDebugEvent({
    level: "info",
    source: "mcp/tool",
    eventType: "mcp.tool.started",
    message: "MCP tool execution started",
    requestId,
    entityType: "mcp_tool",
    entityId: name,
    status: "started",
    metadata: { args },
  });

  try {
    const result = await dispatchTool(name, args);
    succeeded = true;
    return result;
  } catch (error) {
    log.error("MCP tool execution failed", { error });
    const message = error instanceof Error ? error.message : String(error);
    await emitDebugEvent({
      level: "error",
      source: "mcp/tool",
      eventType: "mcp.tool.failed",
      message: "MCP tool execution failed",
      requestId,
      entityType: "mcp_tool",
      entityId: name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      metadata: { args, error: message },
    });
    throw error;
  } finally {
    if (succeeded) {
      await emitDebugEvent({
        level: "info",
        source: "mcp/tool",
        eventType: "mcp.tool.completed",
        message: "MCP tool execution completed",
        requestId,
        entityType: "mcp_tool",
        entityId: name,
        status: "completed",
        durationMs: Date.now() - startedAt,
        metadata: { args },
      });
    }
  }
}
