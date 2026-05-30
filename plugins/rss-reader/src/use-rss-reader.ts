"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { pluginRoute } from "@radarboard/types/api-routes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBoard, createCategory, createManualFeed, DB_KEYS, DEFAULT_UI_STATE } from "./model";
import type {
  RssBoard,
  RssCategory,
  RssFeed,
  RssItem,
  RssSidebarSelection,
  RssUiState,
} from "./types";

interface SyncResponse {
  ok: boolean;
  error?: string;
}

function normalizeFeed(feed: Partial<RssFeed>): RssFeed | null {
  if (!feed.id || !feed.name || !feed.url) return null;

  return {
    id: feed.id,
    name: feed.name,
    url: feed.url,
    origin: feed.origin === "integration" ? "integration" : "manual",
    originRef: feed.origin === "integration" ? (feed.originRef ?? feed.id) : null,
    categoryIds: Array.isArray(feed.categoryIds) ? feed.categoryIds.filter(Boolean) : [],
    isEditable: feed.origin === "integration" ? false : (feed.isEditable ?? true),
    isEnabled: feed.isEnabled ?? true,
    addedAt: feed.addedAt ?? new Date().toISOString(),
  };
}

function normalizeItem(item: Partial<RssItem>): RssItem | null {
  if (!item.id || !item.feedId || !item.title || !item.link || !item.publishedAt) return null;

  return {
    id: item.id,
    feedId: item.feedId,
    title: item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    author: item.author ?? null,
    excerpt: item.excerpt ?? null,
    feedContent: item.feedContent ?? null,
    extractedContent: item.extractedContent ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    heroImageUrl: item.heroImageUrl ?? null,
    heroImageCaption: item.heroImageCaption ?? null,
    read: item.read ?? false,
    saved: item.saved ?? false,
    readLater: item.readLater ?? false,
    boardIds: Array.isArray(item.boardIds) ? item.boardIds.filter(Boolean) : [],
    fetchedAt: item.fetchedAt ?? new Date().toISOString(),
  };
}

export function useRssReader(api: PluginAPI) {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [items, setItems] = useState<RssItem[]>([]);
  const [boards, setBoards] = useState<RssBoard[]>([]);
  const [categories, setCategories] = useState<RssCategory[]>([]);
  const [uiState, setUiState] = useState<RssUiState>(DEFAULT_UI_STATE);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingArticleId, setLoadingArticleId] = useState<string | null>(null);
  const attemptedExtractionsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [storedFeeds, storedItems, storedBoards, storedCategories, storedUiState] =
      await Promise.all([
        api.db.get<Partial<RssFeed>[]>(DB_KEYS.feeds),
        api.db.get<Partial<RssItem>[]>(DB_KEYS.items),
        api.db.get<RssBoard[]>(DB_KEYS.boards),
        api.db.get<RssCategory[]>(DB_KEYS.categories),
        api.db.get<RssUiState>(DB_KEYS.uiState),
      ]);

    setFeeds(
      (storedFeeds ?? [])
        .map(normalizeFeed)
        .filter((feed: RssFeed | null): feed is RssFeed => feed !== null)
    );
    setItems(
      (storedItems ?? [])
        .map(normalizeItem)
        .filter((item: RssItem | null): item is RssItem => item !== null)
    );
    setBoards(storedBoards ?? []);
    setCategories(storedCategories ?? []);
    setUiState(storedUiState ?? DEFAULT_UI_STATE);
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await load();
      if (cancelled) return;
      setLoaded(true);
    }

    bootstrap().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const persistFeeds = useCallback(
    async (updated: RssFeed[]) => {
      setFeeds(updated);
      await api.db.set(DB_KEYS.feeds, updated);
    },
    [api]
  );

  const persistItems = useCallback(
    async (updated: RssItem[]) => {
      setItems(updated);
      await api.db.set(DB_KEYS.items, updated);
    },
    [api]
  );

  const persistBoards = useCallback(
    async (updated: RssBoard[]) => {
      setBoards(updated);
      await api.db.set(DB_KEYS.boards, updated);
    },
    [api]
  );

  const persistCategories = useCallback(
    async (updated: RssCategory[]) => {
      setCategories(updated);
      await api.db.set(DB_KEYS.categories, updated);
    },
    [api]
  );

  const persistUiState = useCallback(
    async (updated: RssUiState) => {
      setUiState(updated);
      await api.db.set(DB_KEYS.uiState, updated);
    },
    [api]
  );

  const syncFeeds = useCallback(
    async (emitNotifications = false) => {
      setSyncing(true);
      try {
        const response = await fetch(pluginRoute("rss-reader", "sync"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emitNotifications }),
        });
        const payload = (await response.json()) as SyncResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to sync RSS feeds");
        }
        await load();
      } finally {
        setSyncing(false);
      }
    },
    [load]
  );

  useEffect(() => {
    if (!loaded) return;
    syncFeeds(false).catch(() => {
      /* fire-and-forget */
    });
  }, [loaded, syncFeeds]);

  const addFeed = useCallback(
    async (input: { name: string; url: string; categoryIds?: string[] }) => {
      const response = await fetch(pluginRoute("rss-reader", "discover"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.url }),
      });
      const payload = (await response.json()) as
        | { ok: true; feedUrl: string }
        | { ok: false; error?: string };

      if (!response.ok || !payload.ok) {
        const errorMessage = "error" in payload ? payload.error : undefined;
        throw new Error(errorMessage ?? "Failed to discover RSS feed");
      }

      const updatedFeeds = [
        ...feeds,
        createManualFeed({
          name: input.name,
          url: payload.feedUrl,
          categoryIds: input.categoryIds,
        }),
      ];

      await persistFeeds(updatedFeeds);
      await syncFeeds(false);
    },
    [feeds, persistFeeds, syncFeeds]
  );

  const updateFeed = useCallback(
    async (
      feedId: string,
      changes: Partial<Pick<RssFeed, "name" | "url" | "categoryIds" | "isEnabled">>
    ) => {
      const existing = feeds.find((feed) => feed.id === feedId);
      if (!existing) return;

      let nextUrl = existing.url;
      if (changes.url && changes.url !== existing.url && existing.isEditable) {
        const response = await fetch(pluginRoute("rss-reader", "discover"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: changes.url }),
        });
        const payload = (await response.json()) as
          | { ok: true; feedUrl: string }
          | { ok: false; error?: string };

        if (!response.ok || !payload.ok) {
          const errorMessage = "error" in payload ? payload.error : undefined;
          throw new Error(errorMessage ?? "Failed to discover RSS feed");
        }
        nextUrl = payload.feedUrl;
      }

      const updatedFeeds = feeds.map((feed) => {
        if (feed.id !== feedId) return feed;
        return {
          ...feed,
          name: existing.isEditable ? (changes.name ?? feed.name) : feed.name,
          url: existing.isEditable ? nextUrl : feed.url,
          categoryIds: changes.categoryIds ?? feed.categoryIds,
          isEnabled: changes.isEnabled ?? feed.isEnabled,
        };
      });

      await persistFeeds(updatedFeeds);
      await syncFeeds(false);
    },
    [feeds, persistFeeds, syncFeeds]
  );

  const removeFeed = useCallback(
    async (feedId: string) => {
      const target = feeds.find((feed) => feed.id === feedId);
      if (!target || !target.isEditable) return;

      const updatedFeeds = feeds.filter((feed) => feed.id !== feedId);
      const updatedItems = items.filter((item) => item.feedId !== feedId);
      await persistFeeds(updatedFeeds);
      await persistItems(updatedItems);
    },
    [feeds, items, persistFeeds, persistItems]
  );

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const category = createCategory(trimmed);
      await persistCategories([...categories, category]);
      return category;
    },
    [categories, persistCategories]
  );

  const addBoard = useCallback(
    async (input: { name: string; description?: string | null }) => {
      const trimmed = input.name.trim();
      if (!trimmed) return null;
      const board = createBoard({ name: trimmed, description: input.description });
      await persistBoards([...boards, board]);
      return board;
    },
    [boards, persistBoards]
  );

  const selectSidebar = useCallback(
    async (selection: RssSidebarSelection) => {
      await persistUiState({ ...uiState, selection });
    },
    [persistUiState, uiState]
  );

  const setSearchQuery = useCallback(
    async (searchQuery: string) => {
      await persistUiState({ ...uiState, searchQuery });
    },
    [persistUiState, uiState]
  );

  const selectItem = useCallback(
    async (itemId: string | null) => {
      await persistUiState({ ...uiState, selectedItemId: itemId });
    },
    [persistUiState, uiState]
  );

  const patchItems = useCallback(
    async (updater: (current: RssItem[]) => RssItem[]) => {
      const next = updater(items);
      await persistItems(next);
    },
    [items, persistItems]
  );

  const markRead = useCallback(
    async (itemId: string) => {
      await patchItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, read: true } : item))
      );
    },
    [patchItems]
  );

  const markUnread = useCallback(
    async (itemId: string) => {
      await patchItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, read: false } : item))
      );
    },
    [patchItems]
  );

  const toggleSaved = useCallback(
    async (itemId: string) => {
      await patchItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, saved: !item.saved } : item))
      );
    },
    [patchItems]
  );

  const toggleReadLater = useCallback(
    async (itemId: string) => {
      await patchItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, readLater: !item.readLater } : item))
      );
    },
    [patchItems]
  );

  const toggleBoard = useCallback(
    async (itemId: string, boardId: string) => {
      await patchItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) return item;
          const boardIds = item.boardIds.includes(boardId)
            ? item.boardIds.filter((candidate: string) => candidate !== boardId)
            : [...item.boardIds, boardId];
          return { ...item, boardIds };
        })
      );
    },
    [patchItems]
  );

  const loadArticle = useCallback(
    async (itemId: string, force = false) => {
      const item = items.find((candidate) => candidate.id === itemId);
      if (
        !item ||
        (!force && (item.extractedContent || attemptedExtractionsRef.current.has(itemId)))
      ) {
        return;
      }

      attemptedExtractionsRef.current.add(itemId);
      setLoadingArticleId(itemId);
      try {
        const response = await fetch(pluginRoute("rss-reader", "article"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.link }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          content?: string | null;
          heroImageUrl?: string | null;
          heroImageCaption?: string | null;
        };

        if (!response.ok || !payload.ok) return;

        await patchItems((current) =>
          current.map((candidate) =>
            candidate.id === itemId
              ? {
                  ...candidate,
                  extractedContent: payload.content ?? candidate.extractedContent ?? null,
                  heroImageUrl: payload.heroImageUrl ?? candidate.heroImageUrl ?? null,
                  heroImageCaption: payload.heroImageCaption ?? candidate.heroImageCaption ?? null,
                }
              : candidate
          )
        );
      } finally {
        setLoadingArticleId((current) => (current === itemId ? null : current));
      }
    },
    [items, patchItems]
  );

  const integrationFeeds = useMemo(
    () => feeds.filter((feed) => feed.origin === "integration"),
    [feeds]
  );
  const manualFeeds = useMemo(() => feeds.filter((feed) => feed.origin === "manual"), [feeds]);
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  return {
    feeds,
    integrationFeeds,
    manualFeeds,
    items,
    boards,
    categories,
    uiState,
    loaded,
    syncing,
    loadingArticleId,
    unreadCount,
    addFeed,
    updateFeed,
    removeFeed,
    addCategory,
    addBoard,
    selectSidebar,
    selectItem,
    setSearchQuery,
    markRead,
    markUnread,
    toggleSaved,
    toggleReadLater,
    toggleBoard,
    loadArticle,
    syncFeeds,
  };
}
