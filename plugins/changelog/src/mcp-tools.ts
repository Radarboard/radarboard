import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import { CHANGELOG_DB_KEYS } from "./model";
import type { ChangelogEntry, PackageWatch } from "./types";

async function getWatches(api: PluginAPI): Promise<PackageWatch[]> {
  return (await api.db.get<PackageWatch[]>(CHANGELOG_DB_KEYS.watches)) ?? [];
}

async function saveWatches(api: PluginAPI, watches: PackageWatch[]): Promise<void> {
  await api.db.set(CHANGELOG_DB_KEYS.watches, watches);
}

async function getEntries(api: PluginAPI): Promise<ChangelogEntry[]> {
  return (await api.db.get<ChangelogEntry[]>(CHANGELOG_DB_KEYS.entries)) ?? [];
}

function makeWatchId(projectSlug: string, platformId: string, packageName: string): string {
  return `${projectSlug}:${platformId}:${packageName}`;
}

function now(): string {
  return new Date().toISOString();
}

export const changelogMcpTools: McpToolDefinition[] = [
  {
    name: "add_package_watch",
    description: "Add or reactivate a project-scoped package watch for the changelog plugin.",
    parameters: z.object({
      packageName: z.string().min(1).describe("Package name, for example @scope/package"),
      projectSlug: z.string().min(1).describe("Project slug"),
      platformId: z.string().min(1).describe("Platform identifier"),
      projectName: z.string().optional().describe("Optional project display name"),
      platformName: z.string().optional().describe("Optional platform display name"),
      includePrereleases: z.boolean().optional().describe("Whether prereleases should be tracked"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as {
        packageName: string;
        projectSlug: string;
        platformId: string;
        projectName?: string;
        platformName?: string;
        includePrereleases?: boolean;
      };
      const watches = await getWatches(api);
      const id = makeWatchId(input.projectSlug, input.platformId, input.packageName);
      const existing = watches.find((watch) => watch.id === id);
      const watch: PackageWatch = existing
        ? {
            ...existing,
            status: "active",
            includePrereleases: input.includePrereleases ?? existing.includePrereleases,
            updatedAt: now(),
          }
        : {
            id,
            projectSlug: input.projectSlug,
            projectName: input.projectName ?? input.projectSlug,
            platformId: input.platformId,
            platformName: input.platformName ?? input.platformId,
            packageName: input.packageName,
            source: "manual",
            status: "active",
            includePrereleases: input.includePrereleases ?? false,
            createdAt: now(),
            lastImportedAt: null,
            updatedAt: now(),
          };

      const next = existing
        ? watches.map((candidate) => (candidate.id === id ? watch : candidate))
        : [...watches, watch];
      await saveWatches(api, next);
      return { success: true, watch };
    },
  },
  {
    name: "list_package_watches",
    description: "List package watches managed by the changelog plugin.",
    parameters: z.object({
      projectSlug: z.string().optional().describe("Optional project slug filter"),
      status: z.enum(["active", "muted", "disabled"]).optional().describe("Optional status filter"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { projectSlug?: string; status?: PackageWatch["status"] };
      let watches = await getWatches(api);
      if (input.projectSlug) {
        watches = watches.filter((watch) => watch.projectSlug === input.projectSlug);
      }
      if (input.status) {
        watches = watches.filter((watch) => watch.status === input.status);
      }
      watches.sort((left, right) => left.id.localeCompare(right.id));
      return { watches, count: watches.length };
    },
  },
  {
    name: "set_package_watch_status",
    description: "Update a package watch status to active, muted, or disabled.",
    parameters: z.object({
      watchId: z.string().min(1).describe("Package watch identifier"),
      status: z.enum(["active", "muted", "disabled"]).describe("Next watch status"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { watchId: string; status: PackageWatch["status"] };
      const watches = await getWatches(api);
      const index = watches.findIndex((watch) => watch.id === input.watchId);
      if (index < 0) return { success: false, error: "Watch not found" };
      const existing = watches[index];
      if (!existing) return { success: false, error: "Watch not found" };

      const nextWatch: PackageWatch = {
        ...existing,
        status: input.status,
        updatedAt: now(),
      };
      const next = [...watches];
      next.splice(index, 1, nextWatch);
      await saveWatches(api, next);
      return { success: true, watch: nextWatch };
    },
  },
  {
    name: "remove_package_watch",
    description: "Remove a package watch from the changelog plugin.",
    parameters: z.object({
      watchId: z.string().min(1).describe("Package watch identifier"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { watchId: string };
      const watches = await getWatches(api);
      const next = watches.filter((watch) => watch.id !== input.watchId);
      if (next.length === watches.length) return { success: false, error: "Watch not found" };
      await saveWatches(api, next);
      return { success: true };
    },
  },
  {
    name: "get_recent_releases",
    description: "Get the most recent tracked release entries from the changelog plugin.",
    parameters: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(5)
        .describe("Max entries to return"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { limit?: number };
      const entries = await getEntries(api);
      const recent = [...entries]
        .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
        .slice(0, input.limit ?? 5);
      return { entries: recent, count: recent.length };
    },
  },
];
