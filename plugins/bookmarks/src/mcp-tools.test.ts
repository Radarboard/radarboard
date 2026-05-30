import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { bookmarksMcpTools } from "./mcp-tools";
import type { Bookmark } from "./types";

function findTool(name: string) {
  const tool = bookmarksMcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Bookmarks MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  describe("add_bookmark", () => {
    it("adds a bookmark with required fields", async () => {
      const tool = findTool("add_bookmark");
      const result = (await tool.execute(
        { title: "Example", url: "https://example.com" },
        api
      )) as { success: boolean; bookmark: Bookmark };

      expect(result.success).toBe(true);
      expect(result.bookmark.title).toBe("Example");
      expect(result.bookmark.url).toBe("https://example.com");
      expect(result.bookmark.tags).toEqual([]);
      expect(result.bookmark.id).toBeTruthy();
    });

    it("adds a bookmark with all fields", async () => {
      const tool = findTool("add_bookmark");
      const result = (await tool.execute(
        {
          title: "Docs",
          url: "https://docs.example.com",
          description: "Official documentation",
          tags: ["docs", "reference"],
        },
        api
      )) as { success: boolean; bookmark: Bookmark };

      expect(result.bookmark.description).toBe("Official documentation");
      expect(result.bookmark.tags).toEqual(["docs", "reference"]);
    });
  });

  describe("list_bookmarks", () => {
    it("returns empty list when no bookmarks exist", async () => {
      const tool = findTool("list_bookmarks");
      const result = (await tool.execute({}, api)) as {
        bookmarks: Bookmark[];
        count: number;
      };
      expect(result.bookmarks).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("filters by tag", async () => {
      const add = findTool("add_bookmark");
      const list = findTool("list_bookmarks");

      await add.execute({ title: "Tagged", url: "https://a.com", tags: ["work"] }, api);
      await add.execute({ title: "Untagged", url: "https://b.com", tags: ["personal"] }, api);

      const result = (await list.execute({ tag: "work" }, api)) as {
        bookmarks: Bookmark[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.bookmarks[0]?.title).toBe("Tagged");
    });
  });

  describe("delete_bookmark", () => {
    it("removes a bookmark", async () => {
      const add = findTool("add_bookmark");
      const del = findTool("delete_bookmark");
      const list = findTool("list_bookmarks");

      const { bookmark } = (await add.execute(
        { title: "Delete me", url: "https://delete.com" },
        api
      )) as { bookmark: Bookmark };
      const result = (await del.execute({ bookmark_id: bookmark.id }, api)) as { success: boolean };

      expect(result.success).toBe(true);
      const remaining = (await list.execute({}, api)) as { count: number };
      expect(remaining.count).toBe(0);
    });

    it("returns error for nonexistent bookmark", async () => {
      const tool = findTool("delete_bookmark");
      const result = (await tool.execute({ bookmark_id: "nope" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Bookmark not found");
    });
  });

  describe("search_bookmarks", () => {
    it("finds by title", async () => {
      const add = findTool("add_bookmark");
      const search = findTool("search_bookmarks");

      await add.execute({ title: "React Docs", url: "https://react.dev" }, api);
      await add.execute({ title: "Vue Guide", url: "https://vuejs.org" }, api);

      const result = (await search.execute({ query: "react" }, api)) as {
        bookmarks: Bookmark[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.bookmarks[0]?.title).toBe("React Docs");
    });

    it("finds by url", async () => {
      const add = findTool("add_bookmark");
      const search = findTool("search_bookmarks");

      await add.execute({ title: "GitHub", url: "https://github.com" }, api);

      const result = (await search.execute({ query: "github" }, api)) as {
        bookmarks: Bookmark[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.bookmarks[0]?.title).toBe("GitHub");
    });

    it("returns empty for no match", async () => {
      const add = findTool("add_bookmark");
      const search = findTool("search_bookmarks");

      await add.execute({ title: "Example", url: "https://example.com" }, api);

      const result = (await search.execute({ query: "nonexistent" }, api)) as {
        bookmarks: Bookmark[];
        count: number;
      };
      expect(result.count).toBe(0);
      expect(result.bookmarks).toEqual([]);
    });
  });
});
