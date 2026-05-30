import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import type { Bookmark } from "./types";

const DB_KEYS = {
  bookmarks: "bookmarks:list",
} as const;

async function getBookmarks(api: PluginAPI): Promise<Bookmark[]> {
  return (await api.db.get<Bookmark[]>(DB_KEYS.bookmarks)) ?? [];
}

async function saveBookmarks(api: PluginAPI, bookmarks: Bookmark[]): Promise<void> {
  await api.db.set(DB_KEYS.bookmarks, bookmarks);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

export const bookmarksMcpTools: McpToolDefinition[] = [
  {
    name: "add_bookmark",
    description: "Add a new bookmark with title, URL, optional description, and tags.",
    parameters: z.object({
      title: z.string().describe("Bookmark title"),
      url: z.string().describe("Bookmark URL"),
      description: z.string().optional().describe("Bookmark description"),
      tags: z.array(z.string()).optional().default([]).describe("Tags for the bookmark"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as { title: string; url: string; description?: string; tags?: string[] };
      const bookmarks = await getBookmarks(api);
      const bookmark: Bookmark = {
        id: generateId(),
        title: input.title,
        url: input.url,
        description: input.description,
        tags: input.tags ?? [],
        createdAt: now(),
      };
      bookmarks.push(bookmark);
      await saveBookmarks(api, bookmarks);
      return { success: true, bookmark };
    },
  },

  {
    name: "list_bookmarks",
    description: "List all bookmarks with an optional tag filter.",
    parameters: z.object({
      tag: z.string().optional().describe("Filter bookmarks by tag"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { tag } = params as { tag?: string };
      let bookmarks = await getBookmarks(api);

      if (tag) bookmarks = bookmarks.filter((b) => b.tags.includes(tag));

      return { bookmarks, count: bookmarks.length };
    },
  },

  {
    name: "delete_bookmark",
    description: "Delete a bookmark by its ID.",
    parameters: z.object({
      bookmark_id: z.string().describe("The bookmark ID to delete"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { bookmark_id } = params as { bookmark_id: string };
      const bookmarks = await getBookmarks(api);
      const filtered = bookmarks.filter((b) => b.id !== bookmark_id);
      if (filtered.length === bookmarks.length)
        return { success: false, error: "Bookmark not found" };

      await saveBookmarks(api, filtered);
      return { success: true };
    },
  },

  {
    name: "search_bookmarks",
    description: "Search bookmarks by query string across title, URL, and description.",
    parameters: z.object({
      query: z.string().describe("Search query string"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { query } = params as { query: string };
      const bookmarks = await getBookmarks(api);
      const q = query.toLowerCase();

      const results = bookmarks.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
      );

      return { bookmarks: results, count: results.length };
    },
  },
];
