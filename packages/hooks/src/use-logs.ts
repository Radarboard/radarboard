"use client";

/**
 * Logs hook — local copy.
 * Canonical version lives in @radarboard/hooks/use-logs.
 * Copied here per 6-file convention; DO NOT delete the original (shared).
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { LogEntry, LogLevel, LogsResponse } from "@radarboard/types/logs";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { usePollingInterval } from "./use-polling-interval";

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function buildUrl(base: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) searchParams.set(key, value);
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

interface UseLogsOptions {
  /** Filter by log level. */
  level?: LogLevel;
  /** Filter by source (partial match). */
  source?: string;
  /** Free-text search across message and source. */
  search?: string;
  /** Max entries to fetch. Default 200. */
  limit?: number;
  /** Enable real-time SSE streaming. */
  live?: boolean;
}

interface UseLogsReturn {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  /** Clear all logs from the buffer. */
  clear: () => Promise<void>;
  /** Force refetch. */
  refetch: () => void;
  /** Whether the SSE connection is active. */
  connected: boolean;
}

/**
 * Hook for fetching and streaming structured log entries.
 *
 * - When `live` is false (default): uses SWR with 5s polling against /api/logs.
 * - When `live` is true: uses Server-Sent Events for real-time streaming.
 */
export function useLogs(options: UseLogsOptions = {}): UseLogsReturn {
  const { level, source, search, limit = 200, live = false } = options;
  const refreshInterval = usePollingInterval("logs");

  // --- SWR polling mode ---
  const key = buildUrl(API_ROUTES.logs, {
    level: level ?? null,
    source: source ?? null,
    search: search ?? null,
    limit: String(limit),
  });

  const {
    data: polledData,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<LogsResponse>(live ? null : key, apiFetcher, {
    refreshInterval,
  });

  // --- SSE live mode ---
  const [sseLogs, setSseLogs] = useState<LogEntry[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!live) {
      // Clean up SSE if switching from live to polling
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setSseConnected(false);
      }
      return;
    }

    const es = new EventSource(API_ROUTES.logsStream);
    eventSourceRef.current = es;

    es.onopen = () => {
      setSseConnected(true);
      setSseError(null);
    };

    const passesFilters = (entry: LogEntry): boolean => {
      if (level && entry.level !== level) return false;
      if (source && !entry.source.includes(source)) return false;
      if (search) {
        const lower = search.toLowerCase();
        return (
          entry.message.toLowerCase().includes(lower) || entry.source.toLowerCase().includes(lower)
        );
      }
      return true;
    };

    const appendEntry = (entry: LogEntry) => {
      setSseLogs((prev) => {
        const next = [...prev, entry];
        return next.length > limit ? next.slice(-limit) : next;
      });
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const entry = JSON.parse(event.data as string) as LogEntry;
        if (passesFilters(entry)) appendEntry(entry);
      } catch {
        // Ignore unparseable messages
      }
    };

    es.onerror = () => {
      setSseConnected(false);
      setSseError("SSE connection failed");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setSseConnected(false);
    };
  }, [live, level, source, search, limit]);

  const clear = useCallback(async () => {
    await fetch(API_ROUTES.logs, { method: "DELETE" });
    setSseLogs([]);
    await mutate();
  }, [mutate]);

  const refetch = useCallback(() => {
    mutate().catch(() => {
      /* fire-and-forget */
    });
  }, [mutate]);

  if (live) {
    return {
      logs: sseLogs,
      loading: false,
      error: sseError,
      clear,
      refetch,
      connected: sseConnected,
    };
  }

  return {
    logs: polledData?.logs ?? [],
    loading: isLoading,
    error: swrError?.message ?? null,
    clear,
    refetch,
    connected: false,
  };
}
