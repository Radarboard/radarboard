"use client";

import type { Cache } from "swr";

/**
 * SWR Cache Provider that persists data to localStorage.
 * This allows the dashboard to show last-known data even after a refresh while offline.
 */
export function persistentCacheProvider(): Cache {
  if (typeof window === "undefined") return new Map() as Cache;

  // Initialize from localStorage
  const storageKey = "radarboard-swr-cache";
  const map = new Map<string, unknown>(JSON.parse(localStorage.getItem(storageKey) || "[]"));

  // Sub-optimal but simple: sync the whole map on window unload
  // For a high-frequency dashboard, we use a throttled approach or beforeunload
  window.addEventListener("beforeunload", () => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    try {
      localStorage.setItem(storageKey, appCache);
    } catch (_e) {
      // Ignore storage quota failures and keep the in-memory cache working.
    }
  });

  return map as Cache;
}
