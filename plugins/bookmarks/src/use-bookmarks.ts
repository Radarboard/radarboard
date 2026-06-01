"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useState } from "react";
import type { Bookmark } from "./types";

const DB_KEYS = {
  bookmarks: "bookmarks:list",
} as const;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

const DEMO_BOOKMARKS: Bookmark[] = [
  {
    id: "demo-1",
    title: "Vercel Edge Functions docs",
    url: "https://vercel.com/docs/functions/edge-functions",
    tags: ["docs", "vercel"],
    createdAt: "2026-03-25T12:00:00Z",
  },
  {
    id: "demo-2",
    title: "Stripe Billing API reference",
    url: "https://stripe.com/docs/api/subscriptions",
    tags: ["docs", "stripe"],
    createdAt: "2026-03-24T09:00:00Z",
  },
  {
    id: "demo-3",
    title: "React 19 release notes",
    url: "https://react.dev/blog/2024/12/05/react-19",
    tags: ["react", "release"],
    createdAt: "2026-03-23T14:00:00Z",
  },
  {
    id: "demo-4",
    title: "Tailwind CSS v4 migration guide",
    url: "https://tailwindcss.com/docs/upgrade-guide",
    tags: ["css", "migration"],
    createdAt: "2026-03-22T11:00:00Z",
  },
];

export function useBookmarks(api: PluginAPI) {
  const { isDemoMode } = useDemoMode();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setBookmarks(DEMO_BOOKMARKS);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    async function load() {
      const b = await api.db.get<Bookmark[]>(DB_KEYS.bookmarks);
      if (cancelled) return;
      if (b) setBookmarks(b);
      setLoaded(true);
    }
    load().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [api, isDemoMode]);

  const persistBookmarks = useCallback(
    async (updated: Bookmark[]) => {
      setBookmarks(updated);
      if (isDemoMode) return;
      await api.db.set(DB_KEYS.bookmarks, updated);
    },
    [api, isDemoMode]
  );

  const addBookmark = useCallback(
    async (input: { title: string; url: string; description?: string; tags?: string[] }) => {
      const bookmark: Bookmark = {
        id: generateId(),
        title: input.title,
        url: input.url,
        description: input.description,
        tags: input.tags ?? [],
        createdAt: now(),
      };
      const updated = [...bookmarks, bookmark];
      await persistBookmarks(updated);
      return bookmark;
    },
    [bookmarks, persistBookmarks]
  );

  const deleteBookmark = useCallback(
    async (id: string) => {
      const updated = bookmarks.filter((b) => b.id !== id);
      await persistBookmarks(updated);
    },
    [bookmarks, persistBookmarks]
  );

  return {
    bookmarks,
    loaded,
    addBookmark,
    deleteBookmark,
  };
}
