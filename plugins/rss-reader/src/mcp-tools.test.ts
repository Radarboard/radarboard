import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rssReaderMcpTools } from "./mcp-tools";
import type { RssFeed, RssItem } from "./types";

function findTool(name: string) {
  const tool = rssReaderMcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

function createTestItem(
  overrides: Partial<RssItem> & Pick<RssItem, "id" | "feedId" | "title" | "link" | "publishedAt">
): RssItem {
  return {
    id: overrides.id,
    feedId: overrides.feedId,
    title: overrides.title,
    link: overrides.link,
    publishedAt: overrides.publishedAt,
    author: overrides.author ?? null,
    excerpt: overrides.excerpt ?? null,
    feedContent: overrides.feedContent ?? null,
    extractedContent: overrides.extractedContent ?? null,
    read: overrides.read ?? false,
    saved: overrides.saved ?? false,
    readLater: overrides.readLater ?? false,
    boardIds: overrides.boardIds ?? [],
    fetchedAt: overrides.fetchedAt ?? new Date().toISOString(),
  };
}

describe("RSS Reader MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
    vi.unstubAllGlobals();
  });

  describe("add_feed", () => {
    it("creates a feed with name and url", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response('<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>', {
            status: 200,
            headers: { "Content-Type": "application/rss+xml" },
          })
        )
      );

      const tool = findTool("add_feed");
      const result = (await tool.execute(
        { name: "Hacker News", url: "https://hnrss.org/frontpage" },
        api
      )) as { success: boolean; feed: RssFeed };

      expect(result.success).toBe(true);
      expect(result.feed.name).toBe("Hacker News");
      expect(result.feed.url).toBe("https://hnrss.org/frontpage");
      expect(result.feed.id).toBeTruthy();
      expect(result.feed.addedAt).toBeTruthy();
    });

    it("discovers a feed URL from a normal website URL", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(
              '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml" /></head></html>',
              {
                status: 200,
                headers: { "Content-Type": "text/html" },
              }
            )
          )
          .mockResolvedValueOnce(
            new Response('<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>', {
              status: 200,
              headers: { "Content-Type": "application/rss+xml" },
            })
          )
      );

      const tool = findTool("add_feed");
      const result = (await tool.execute(
        { name: "Example", url: "https://example.com/blog" },
        api
      )) as { success: boolean; feed: RssFeed };

      expect(result.success).toBe(true);
      expect(result.feed.url).toBe("https://example.com/feed.xml");
    });

    it("persists feeds across calls", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(
          async (input: string | URL) =>
            new Response(
              `<?xml version="1.0"?><rss><channel><title>${String(input)}</title></channel></rss>`,
              {
                status: 200,
                headers: { "Content-Type": "application/rss+xml" },
              }
            )
        )
      );

      const add = findTool("add_feed");
      const list = findTool("list_feeds");

      await add.execute({ name: "Feed 1", url: "https://example.com/feed1" }, api);
      await add.execute({ name: "Feed 2", url: "https://example.com/feed2" }, api);

      const result = (await list.execute({}, api)) as {
        feeds: RssFeed[];
        count: number;
      };
      expect(result.count).toBe(2);
      expect(result.feeds.map((f) => f.name)).toEqual(["Feed 1", "Feed 2"]);
    });
  });

  describe("list_feeds", () => {
    it("returns empty list when no feeds exist", async () => {
      const tool = findTool("list_feeds");
      const result = (await tool.execute({}, api)) as {
        feeds: RssFeed[];
        count: number;
      };
      expect(result.feeds).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("returns all added feeds", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(
          async (input: string | URL) =>
            new Response(
              `<?xml version="1.0"?><rss><channel><title>${String(input)}</title></channel></rss>`,
              {
                status: 200,
                headers: { "Content-Type": "application/rss+xml" },
              }
            )
        )
      );

      const add = findTool("add_feed");
      const list = findTool("list_feeds");

      await add.execute({ name: "Blog A", url: "https://a.com/rss" }, api);
      await add.execute({ name: "Blog B", url: "https://b.com/rss" }, api);

      const result = (await list.execute({}, api)) as {
        feeds: RssFeed[];
        count: number;
      };
      expect(result.count).toBe(2);
    });
  });

  describe("remove_feed", () => {
    it("removes a feed and its items", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response('<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>', {
            status: 200,
            headers: { "Content-Type": "application/rss+xml" },
          })
        )
      );

      const add = findTool("add_feed");
      const remove = findTool("remove_feed");
      const list = findTool("list_feeds");
      const getItems = findTool("get_recent_items");

      const { feed } = (await add.execute(
        { name: "Remove me", url: "https://example.com/rss" },
        api
      )) as { feed: RssFeed };

      // Seed items for this feed
      const items: RssItem[] = [
        createTestItem({
          id: "item-1",
          feedId: feed.id,
          title: "Article 1",
          link: "https://example.com/1",
          publishedAt: new Date().toISOString(),
        }),
      ];
      await api.db.set("rss:items", items);

      const result = (await remove.execute({ feed_id: feed.id }, api)) as {
        success: boolean;
      };
      expect(result.success).toBe(true);

      const remaining = (await list.execute({}, api)) as { count: number };
      expect(remaining.count).toBe(0);

      const remainingItems = (await getItems.execute({}, api)) as { count: number };
      expect(remainingItems.count).toBe(0);
    });

    it("returns error for nonexistent feed", async () => {
      const tool = findTool("remove_feed");
      const result = (await tool.execute({ feed_id: "fake-id" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Feed not found");
    });
  });

  describe("get_recent_items", () => {
    it("returns empty list when no items exist", async () => {
      const tool = findTool("get_recent_items");
      const result = (await tool.execute({}, api)) as {
        items: RssItem[];
        count: number;
      };
      expect(result.items).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("returns items sorted by publishedAt desc", async () => {
      const tool = findTool("get_recent_items");

      const items: RssItem[] = [
        createTestItem({
          id: "item-old",
          feedId: "feed-1",
          title: "Old Article",
          link: "https://example.com/old",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
        createTestItem({
          id: "item-new",
          feedId: "feed-1",
          title: "New Article",
          link: "https://example.com/new",
          publishedAt: "2026-03-19T00:00:00.000Z",
        }),
      ];
      await api.db.set("rss:items", items);

      const result = (await tool.execute({}, api)) as {
        items: RssItem[];
        count: number;
      };
      expect(result.count).toBe(2);
      expect(result.items[0]?.title).toBe("New Article");
      expect(result.items[1]?.title).toBe("Old Article");
    });

    it("filters by feed_id", async () => {
      const tool = findTool("get_recent_items");

      const items: RssItem[] = [
        createTestItem({
          id: "item-a",
          feedId: "feed-1",
          title: "Feed 1 Article",
          link: "https://example.com/a",
          publishedAt: "2026-03-19T00:00:00.000Z",
        }),
        createTestItem({
          id: "item-b",
          feedId: "feed-2",
          title: "Feed 2 Article",
          link: "https://example.com/b",
          publishedAt: "2026-03-19T01:00:00.000Z",
        }),
      ];
      await api.db.set("rss:items", items);

      const result = (await tool.execute({ feed_id: "feed-1" }, api)) as {
        items: RssItem[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.items[0]?.title).toBe("Feed 1 Article");
    });
  });

  describe("mark_read", () => {
    it("marks an item as read", async () => {
      const tool = findTool("mark_read");

      const items: RssItem[] = [
        createTestItem({
          id: "item-1",
          feedId: "feed-1",
          title: "Unread Article",
          link: "https://example.com/1",
          publishedAt: "2026-03-19T00:00:00.000Z",
        }),
      ];
      await api.db.set("rss:items", items);

      const result = (await tool.execute({ item_id: "item-1" }, api)) as {
        success: boolean;
        item: RssItem;
      };

      expect(result.success).toBe(true);
      expect(result.item.read).toBe(true);
    });

    it("returns error for nonexistent item", async () => {
      const tool = findTool("mark_read");
      const result = (await tool.execute({ item_id: "fake-id" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
    });
  });
});
