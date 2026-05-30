import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { changelogMcpTools } from "./mcp-tools";
import { CHANGELOG_DB_KEYS } from "./model";
import type { ChangelogEntry, PackageWatch } from "./types";

function findTool(name: string) {
  const tool = changelogMcpTools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Changelog MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  it("adds and lists package watches", async () => {
    const add = findTool("add_package_watch");
    const list = findTool("list_package_watches");

    const result = (await add.execute(
      {
        packageName: "@radarboard/widget-engine",
        projectSlug: "radarboard",
        platformId: "web",
        projectName: "Radarboard",
        platformName: "Web App",
      },
      api
    )) as { success: boolean; watch: PackageWatch };

    expect(result.success).toBe(true);
    expect(result.watch.packageName).toBe("@radarboard/widget-engine");
    expect(result.watch.status).toBe("active");

    const listed = (await list.execute({}, api)) as { watches: PackageWatch[]; count: number };
    expect(listed.count).toBe(1);
    expect(listed.watches[0]?.id).toBe("radarboard:web:@radarboard/widget-engine");
  });

  it("updates watch status", async () => {
    const add = findTool("add_package_watch");
    const setStatus = findTool("set_package_watch_status");
    const list = findTool("list_package_watches");

    await add.execute(
      {
        packageName: "@radarboard/widget-engine",
        projectSlug: "radarboard",
        platformId: "web",
      },
      api
    );

    const updated = (await setStatus.execute(
      {
        watchId: "radarboard:web:@radarboard/widget-engine",
        status: "muted",
      },
      api
    )) as { success: boolean; watch: PackageWatch };

    expect(updated.success).toBe(true);
    expect(updated.watch.status).toBe("muted");

    const listed = (await list.execute({ status: "muted" }, api)) as {
      watches: PackageWatch[];
      count: number;
    };
    expect(listed.count).toBe(1);
    expect(listed.watches[0]?.status).toBe("muted");
  });

  it("removes package watches", async () => {
    const add = findTool("add_package_watch");
    const remove = findTool("remove_package_watch");

    await add.execute(
      {
        packageName: "@radarboard/widget-engine",
        projectSlug: "radarboard",
        platformId: "web",
      },
      api
    );

    const removed = (await remove.execute(
      { watchId: "radarboard:web:@radarboard/widget-engine" },
      api
    )) as {
      success: boolean;
    };
    expect(removed.success).toBe(true);

    const stored = await api.db.get<PackageWatch[]>(CHANGELOG_DB_KEYS.watches);
    expect(stored).toEqual([]);
  });

  it("returns recent releases from stored entries", async () => {
    const tool = findTool("get_recent_releases");

    await api.db.set<ChangelogEntry[]>(CHANGELOG_DB_KEYS.entries, [
      {
        id: "release:@radarboard/widget-engine:1.0.0",
        title: "@radarboard/widget-engine 1.0.0",
        description: "Initial release",
        version: "1.0.0",
        packageName: "@radarboard/widget-engine",
        date: "2026-03-01",
        type: "release",
        sourceType: "github_release",
        notesQuality: "full",
        releaseUrl: "https://example.com/release",
        publishedAt: "2026-03-01T10:00:00.000Z",
        isPrerelease: false,
        watchIds: ["radarboard:web:@radarboard/widget-engine"],
        projectSlugs: ["radarboard"],
        platformIds: ["web"],
        projectId: "radarboard",
        createdAt: "2026-03-01T10:00:00.000Z",
      },
      {
        id: "release:@radarboard/widget-engine:1.1.0",
        title: "@radarboard/widget-engine 1.1.0",
        description: "Second release",
        version: "1.1.0",
        packageName: "@radarboard/widget-engine",
        date: "2026-03-10",
        type: "release",
        sourceType: "npm_publish",
        notesQuality: "minimal",
        releaseUrl: "https://example.com/release-2",
        publishedAt: "2026-03-10T10:00:00.000Z",
        isPrerelease: false,
        watchIds: ["radarboard:web:@radarboard/widget-engine"],
        projectSlugs: ["radarboard"],
        platformIds: ["web"],
        projectId: "radarboard",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ]);

    const result = (await tool.execute({ limit: 1 }, api)) as {
      entries: ChangelogEntry[];
      count: number;
    };
    expect(result.count).toBe(1);
    expect(result.entries[0]?.version).toBe("1.1.0");
  });
});
