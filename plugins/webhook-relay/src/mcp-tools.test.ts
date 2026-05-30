import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { webhookRelayMcpTools } from "./mcp-tools";
import type { RelayEventSummary } from "./types";

function findTool(name: string) {
  const tool = webhookRelayMcpTools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

function buildEvent(
  overrides: Partial<RelayEventSummary> & Pick<RelayEventSummary, "id" | "integration" | "type">
): RelayEventSummary {
  return {
    id: overrides.id,
    integration: overrides.integration,
    type: overrides.type,
    severity: overrides.severity ?? "info",
    title: overrides.title ?? overrides.type,
    body: overrides.body ?? null,
    receivedAt: overrides.receivedAt ?? Date.now(),
    metadata: overrides.metadata ?? {},
  };
}

describe("Webhook Relay MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  describe("list_recent_webhooks", () => {
    it("returns the most recent events first even when storage order is stale", async () => {
      await api.db.set("relay-events", [
        buildEvent({
          id: "oldest",
          integration: "github",
          type: "push",
          receivedAt: 1_000,
        }),
        buildEvent({
          id: "newest",
          integration: "vercel",
          type: "deployment",
          receivedAt: 3_000,
        }),
        buildEvent({
          id: "middle",
          integration: "sentry",
          type: "issue",
          receivedAt: 2_000,
        }),
      ]);

      const tool = findTool("list_recent_webhooks");
      const result = (await tool.execute({}, api)) as {
        events: RelayEventSummary[];
        total: number;
      };

      expect(result.total).toBe(3);
      expect(result.events.map((event) => event.id)).toEqual(["newest", "middle", "oldest"]);
    });
  });

  describe("analyze_webhook_patterns", () => {
    it("summarizes only events inside the requested lookback window", async () => {
      await api.db.set("relay-events", [
        buildEvent({
          id: "recent-critical-1",
          integration: "github",
          type: "push",
          severity: "critical",
          receivedAt: 9_700,
        }),
        buildEvent({
          id: "recent-critical-2",
          integration: "github",
          type: "push",
          severity: "critical",
          receivedAt: 9_800,
        }),
        buildEvent({
          id: "recent-warning",
          integration: "vercel",
          type: "deployment",
          severity: "warning",
          receivedAt: 9_900,
        }),
        buildEvent({
          id: "old-event",
          integration: "sentry",
          type: "issue",
          severity: "warning",
          receivedAt: 2_000,
        }),
      ]);

      const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
      const tool = findTool("analyze_webhook_patterns");
      const result = (await tool.execute({ since_minutes: 0.1 }, api)) as {
        window: string;
        totalEvents: number;
        byIntegration: Record<string, number>;
        bySeverity: Record<string, number>;
        topEventTypes: Array<{ type: string; count: number }>;
        anomalies: { elevated: boolean; critical?: number; warning?: number };
      };
      nowSpy.mockRestore();

      expect(result).toMatchObject({
        window: "0.1m",
        totalEvents: 3,
        byIntegration: {
          github: 2,
          vercel: 1,
        },
        bySeverity: {
          critical: 2,
          warning: 1,
        },
        anomalies: {
          elevated: false,
        },
      });
      expect(result.topEventTypes).toEqual([
        { type: "push", count: 2 },
        { type: "deployment", count: 1 },
      ]);
    });
  });
});
