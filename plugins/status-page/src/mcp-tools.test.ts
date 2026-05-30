import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { statusPageMcpTools } from "./mcp-tools";
import type { StatusSource } from "./types";

function findTool(name: string) {
  const tool = statusPageMcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Status Page MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  describe("add_status_source", () => {
    it("adds a source with required fields", async () => {
      const tool = findTool("add_status_source");
      const result = (await tool.execute({ name: "GitHub", url: "https://github.com" }, api)) as {
        success: boolean;
        source: StatusSource;
      };

      expect(result.success).toBe(true);
      expect(result.source.name).toBe("GitHub");
      expect(result.source.url).toBe("https://github.com");
      expect(result.source.status).toBe("unknown");
      expect(result.source.kind).toBe("standalone");
      expect(result.source.id).toBeTruthy();
      expect(result.source.statusPageUrl).toBeUndefined();
    });

    it("adds a source with statusPageUrl", async () => {
      const tool = findTool("add_status_source");
      const result = (await tool.execute(
        {
          name: "GitHub",
          url: "https://github.com",
          statusPageUrl: "https://www.githubstatus.com",
        },
        api
      )) as { success: boolean; source: StatusSource };

      expect(result.success).toBe(true);
      expect(result.source.statusPageUrl).toBe("https://www.githubstatus.com");
    });
  });

  describe("list_services_status", () => {
    it("returns empty list when no sources exist", async () => {
      const tool = findTool("list_services_status");
      const result = (await tool.execute({}, api)) as {
        sources: StatusSource[];
        count: number;
      };
      expect(result.sources).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("returns all added sources", async () => {
      const add = findTool("add_status_source");
      const list = findTool("list_services_status");

      await add.execute({ name: "GitHub", url: "https://github.com" }, api);
      await add.execute({ name: "Vercel", url: "https://vercel.com" }, api);

      const result = (await list.execute({}, api)) as {
        sources: StatusSource[];
        count: number;
      };
      expect(result.count).toBe(2);
      expect(result.sources.map((s) => s.name)).toEqual(["GitHub", "Vercel"]);
    });
  });

  describe("remove_status_source", () => {
    it("removes a source", async () => {
      const add = findTool("add_status_source");
      const remove = findTool("remove_status_source");
      const list = findTool("list_services_status");

      const { source } = (await add.execute(
        { name: "GitHub", url: "https://github.com" },
        api
      )) as { source: StatusSource };

      const result = (await remove.execute({ source_id: source.id }, api)) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
      const remaining = (await list.execute({}, api)) as { count: number };
      expect(remaining.count).toBe(0);
    });

    it("returns error for nonexistent source", async () => {
      const tool = findTool("remove_status_source");
      const result = (await tool.execute({ source_id: "fake-id" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Source not found");
    });
  });
});
