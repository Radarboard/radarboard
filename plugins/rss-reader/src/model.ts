import type { RssBoard, RssCategory, RssFeed, RssUiState } from "@radarboard/types/rss";
import { DB_KEYS, RSS_PLUGIN_ID } from "@radarboard/types/rss";

export { DB_KEYS, RSS_PLUGIN_ID };

export const DEFAULT_UI_STATE: RssUiState = {
  selection: { kind: "all-unread" },
  selectedItemId: null,
  searchQuery: "",
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function createManualFeed(input: {
  name: string;
  url: string;
  categoryIds?: string[];
}): RssFeed {
  return {
    id: generateId(),
    name: input.name,
    url: input.url,
    origin: "manual",
    originRef: null,
    categoryIds: input.categoryIds ?? [],
    isEditable: true,
    isEnabled: true,
    addedAt: now(),
  };
}

export function createBoard(input: { name: string; description?: string | null }): RssBoard {
  return {
    id: generateId(),
    name: input.name,
    description: input.description ?? null,
    createdAt: now(),
  };
}

export function createCategory(name: string): RssCategory {
  return {
    id: generateId(),
    name,
    createdAt: now(),
  };
}
