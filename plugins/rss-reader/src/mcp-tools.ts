import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import { discoverFeedFromUrl, FeedDiscoveryError } from "./discovery";
import { createManualFeed, DB_KEYS } from "./model";
import type { RssFeed, RssItem } from "./types";

async function getFeeds(api: PluginAPI): Promise<RssFeed[]> {
  return (await api.db.get<RssFeed[]>(DB_KEYS.feeds)) ?? [];
}

async function saveFeeds(api: PluginAPI, feeds: RssFeed[]): Promise<void> {
  await api.db.set(DB_KEYS.feeds, feeds);
}

async function getItems(api: PluginAPI): Promise<RssItem[]> {
  return (await api.db.get<RssItem[]>(DB_KEYS.items)) ?? [];
}

async function saveItems(api: PluginAPI, items: RssItem[]): Promise<void> {
  await api.db.set(DB_KEYS.items, items);
}

export const rssReaderMcpTools: McpToolDefinition[] = [
  {
    name: "add_feed",
    description: "Add a new RSS feed to track.",
    parameters: z.object({
      name: z.string().describe("Display name for the feed"),
      url: z.string().describe("Website URL or RSS feed URL"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { name: string; url: string };
      try {
        const discovery = await discoverFeedFromUrl(input.url);
        const feeds = await getFeeds(api);
        const feed = createManualFeed({ name: input.name, url: discovery.feedUrl });
        feeds.push(feed);
        await saveFeeds(api, feeds);
        return { success: true, feed, discovery };
      } catch (error) {
        if (error instanceof FeedDiscoveryError) {
          return { success: false, error: error.message };
        }
        throw error;
      }
    },
  },

  {
    name: "remove_feed",
    description: "Remove an RSS feed and all its associated items.",
    parameters: z.object({
      feed_id: z.string().describe("The feed ID to remove"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { feed_id } = params as { feed_id: string };
      const feeds = await getFeeds(api);
      const target = feeds.find((feed) => feed.id === feed_id);
      if (!target) return { success: false, error: "Feed not found" };
      if (!target.isEditable) {
        return {
          success: false,
          error: "Integration feeds must be managed from Integrations settings",
        };
      }

      const filtered = feeds.filter((feed) => feed.id !== feed_id);

      await saveFeeds(api, filtered);

      // Remove all items associated with this feed
      const items = await getItems(api);
      const remainingItems = items.filter((i) => i.feedId !== feed_id);
      await saveItems(api, remainingItems);

      return { success: true };
    },
  },

  {
    name: "list_feeds",
    description: "List all tracked RSS feeds.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const feeds = await getFeeds(api);
      return { feeds, count: feeds.length };
    },
  },

  {
    name: "get_recent_items",
    description:
      "Get recent RSS items, optionally filtered by feed, sorted by published date descending.",
    parameters: z.object({
      feed_id: z.string().optional().describe("Filter by feed ID"),
      limit: z.number().optional().default(20).describe("Max items to return (default 20)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { feed_id?: string; limit?: number };
      let items = await getItems(api);

      if (input.feed_id) {
        items = items.filter((i) => i.feedId === input.feed_id);
      }

      items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

      const limit = input.limit ?? 20;
      const sliced = items.slice(0, limit);

      return { items: sliced, count: sliced.length };
    },
  },

  {
    name: "mark_read",
    description: "Mark an RSS item as read.",
    parameters: z.object({
      item_id: z.string().describe("The item ID to mark as read"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { item_id } = params as { item_id: string };
      const items = await getItems(api);
      const item = items.find((i) => i.id === item_id);
      if (!item) return { success: false, error: "Item not found" };

      item.read = true;
      await saveItems(api, items);
      return { success: true, item };
    },
  },
];
