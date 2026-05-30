import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import type { RelayEventSummary, RelayStats } from "./types";

const EVENTS_KEY = "relay-events";
const STATS_KEY = "relay-stats";

async function getStoredEvents(api: PluginAPI): Promise<RelayEventSummary[]> {
  return (await api.db.get<RelayEventSummary[]>(EVENTS_KEY)) ?? [];
}

async function getStoredStats(api: PluginAPI): Promise<RelayStats | null> {
  return api.db.get<RelayStats>(STATS_KEY);
}

export const webhookRelayMcpTools: McpToolDefinition[] = [
  {
    name: "list_recent_webhooks",
    description:
      "List the most recent webhook events received by the relay, optionally filtered by integration name.",
    parameters: z.object({
      integration: z
        .string()
        .optional()
        .describe("Filter by integration (github, vercel, sentry, linear, betterstack)"),
      limit: z.number().optional().describe("Max events to return (default 20)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { integration, limit = 20 } = params as { integration?: string; limit?: number };
      let events = [...(await getStoredEvents(api))].sort(
        (left, right) => right.receivedAt - left.receivedAt
      );
      if (integration) {
        events = events.filter((e) => e.integration === integration);
      }
      return { events: events.slice(0, limit), total: events.length };
    },
  },

  {
    name: "get_relay_health",
    description:
      "Get the current health and statistics of the webhook relay including event counts per integration and connection status.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const stats = await getStoredStats(api);
      if (!stats) {
        return {
          status: "no_data",
          message:
            "No relay data available. Ensure the relay URL is configured in Settings > Integrations.",
        };
      }
      return stats;
    },
  },

  {
    name: "analyze_webhook_patterns",
    description:
      "Analyze webhook event patterns — frequency by integration and severity, and identify any anomalies like error spikes.",
    parameters: z.object({
      since_minutes: z.number().optional().describe("Look back window in minutes (default 60)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { since_minutes = 60 } = params as { since_minutes?: number };
      const cutoff = Date.now() - since_minutes * 60 * 1000;
      const events = (await getStoredEvents(api)).filter((e) => e.receivedAt >= cutoff);

      const byIntegration: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byType: Record<string, number> = {};

      for (const event of events) {
        byIntegration[event.integration] = (byIntegration[event.integration] ?? 0) + 1;
        bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1;
        byType[event.type] = (byType[event.type] ?? 0) + 1;
      }

      const criticalCount = bySeverity.critical ?? 0;
      const warningCount = bySeverity.warning ?? 0;

      return {
        window: `${since_minutes}m`,
        totalEvents: events.length,
        byIntegration,
        bySeverity,
        topEventTypes: Object.entries(byType)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([type, count]) => ({ type, count })),
        anomalies:
          criticalCount > 5 || warningCount > 10
            ? { elevated: true, critical: criticalCount, warning: warningCount }
            : { elevated: false },
      };
    },
  },
];
