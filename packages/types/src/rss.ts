export type RssFeedOrigin = "manual" | "integration";

export interface RssFeed {
  id: string;
  name: string;
  url: string;
  origin: RssFeedOrigin;
  originRef: string | null;
  categoryIds: string[];
  isEditable: boolean;
  isEnabled: boolean;
  addedAt: string;
}

export interface RssBoard {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface RssCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface RssItem {
  id: string;
  feedId: string;
  title: string;
  link: string;
  publishedAt: string;
  author?: string | null;
  excerpt?: string | null;
  feedContent?: string | null;
  extractedContent?: string | null;
  thumbnailUrl?: string | null;
  heroImageUrl?: string | null;
  heroImageCaption?: string | null;
  read: boolean;
  saved: boolean;
  readLater: boolean;
  boardIds: string[];
  fetchedAt: string;
}

export type RssSidebarSelection =
  | { kind: "all-unread" }
  | { kind: "saved" }
  | { kind: "read-later" }
  | { kind: "integrations" }
  | { kind: "manual-feeds" }
  | { kind: "boards" }
  | { kind: "board"; boardId: string }
  | { kind: "categories" }
  | { kind: "category"; categoryId: string }
  | { kind: "feed"; feedId: string };

export interface RssUiState {
  selection: RssSidebarSelection;
  selectedItemId: string | null;
  searchQuery: string;
}

export const RSS_PLUGIN_ID = "rss-reader";

export const DB_KEYS = {
  feeds: "rss:feeds",
  items: "rss:items",
  boards: "rss:boards",
  categories: "rss:categories",
  uiState: "rss:ui-state",
} as const;
