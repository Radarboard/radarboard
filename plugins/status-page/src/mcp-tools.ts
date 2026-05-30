import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import { STATUS_PAGE_STANDALONE_SOURCES_KEY } from "./statuspage";
import type { StatusSource } from "./types";

async function getSources(api: PluginAPI): Promise<StatusSource[]> {
  return (await api.db.get<StatusSource[]>(STATUS_PAGE_STANDALONE_SOURCES_KEY)) ?? [];
}

async function saveSources(api: PluginAPI, sources: StatusSource[]): Promise<void> {
  await api.db.set(STATUS_PAGE_STANDALONE_SOURCES_KEY, sources);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

export const statusPageMcpTools: McpToolDefinition[] = [
  {
    name: "list_services_status",
    description: "List all monitored services and their current status.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const sources = await getSources(api);
      return { sources, count: sources.length };
    },
  },

  {
    name: "add_status_source",
    description:
      "Add a new service to monitor by providing its name, URL, and optional status page URL.",
    parameters: z.object({
      name: z.string().describe("Service name"),
      url: z.string().describe("Service URL to monitor"),
      statusPageUrl: z.string().optional().describe("Optional status page URL"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { name: string; url: string; statusPageUrl?: string };
      const sources = await getSources(api);
      const source: StatusSource = {
        id: generateId(),
        kind: "standalone",
        name: input.name,
        url: input.url,
        statusPageUrl: input.statusPageUrl,
        status: "unknown",
        lastCheckedAt: now(),
        addedAt: now(),
        alertsEnabled: true,
        remoteUpdatedAt: null,
        projectSlug: null,
        projectName: null,
        platformId: null,
        platformName: null,
        integrationKey: null,
      };
      sources.push(source);
      await saveSources(api, sources);
      return { success: true, source };
    },
  },

  {
    name: "remove_status_source",
    description: "Remove a monitored service by its ID.",
    parameters: z.object({
      source_id: z.string().describe("The source ID to remove"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { source_id } = params as { source_id: string };
      const sources = await getSources(api);
      const filtered = sources.filter((s) => s.id !== source_id);
      if (filtered.length === sources.length) return { success: false, error: "Source not found" };

      await saveSources(api, filtered);
      return { success: true };
    },
  },
];
