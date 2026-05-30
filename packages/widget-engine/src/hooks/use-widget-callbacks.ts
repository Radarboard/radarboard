"use client";

/**
 * useWidgetCallbacks
 *
 * Use this hook in every widget component that needs to report its fetch
 * timestamp and/or register a refetch function with the parent WidgetCard.
 *
 * Replaces the two boilerplate useEffects that every data-fetching widget
 * previously duplicated:
 *
 *   useEffect(() => { onFetchedAt?.(fetchedAt); }, [fetchedAt, onFetchedAt]);
 *   useEffect(() => { onRefetch?.(refetch);     }, [refetch,   onRefetch]);
 *
 * Do NOT inline those effects in widget files — use this hook instead.
 */

import type { TimeRange } from "@radarboard/types/dashboard";
import { emitWidgetDebugEvent } from "@radarboard/widget-sdk/debug-events";
import type { WidgetChromeStatus } from "@radarboard/widget-sdk/widget-types";
import { useEffect, useRef } from "react";

function emitRefreshDebugEvent(
  widgetId: string,
  projectSlug: string | null,
  requestId: string | null,
  status: "started" | "completed" | "failed",
  durationMs: number,
  metadata: Record<string, unknown>
) {
  const isError = status === "failed";
  return emitWidgetDebugEvent({
    level: isError ? "error" : "info",
    source: "widget/refresh",
    eventType: `widget.refresh.${status}`,
    message: `Widget refresh ${status}`,
    projectSlug,
    requestId,
    entityType: "widget",
    entityId: widgetId,
    status,
    ...(durationMs > 0 ? { durationMs } : {}),
    metadata,
  });
}

interface UseWidgetCallbacksOptions {
  widgetId?: string | null;
  projectSlug?: string | null;
  timeRange?: TimeRange;
  sourceIds?: string[];
  fetchedAt: number | null;
  loading?: boolean;
  error?: string | null;
  refetch: (() => Promise<void>) | null;
  chromeStatus?: WidgetChromeStatus;
  onFetchedAt?: (ts: number | null) => void;
  onRefetch?: (fn: (() => Promise<void>) | null) => void;
  onChromeStateChange?: (status: WidgetChromeStatus) => void;
}

export function useWidgetCallbacks({
  widgetId,
  projectSlug = null,
  timeRange,
  sourceIds,
  fetchedAt,
  loading = false,
  error = null,
  refetch,
  chromeStatus = "default",
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
}: UseWidgetCallbacksOptions): void {
  const refreshCycleRef = useRef<{
    active: boolean;
    requestId: string | null;
    startedAt: number;
  }>({
    active: false,
    requestId: null,
    startedAt: 0,
  });

  useEffect(() => {
    onFetchedAt?.(fetchedAt);
  }, [fetchedAt, onFetchedAt]);

  useEffect(() => {
    onRefetch?.(refetch);
  }, [refetch, onRefetch]);

  useEffect(() => {
    onChromeStateChange?.(chromeStatus);
  }, [chromeStatus, onChromeStateChange]);

  useEffect(() => {
    if (!widgetId) return;

    const cycle = refreshCycleRef.current;
    const meta = { sourceIds: sourceIds ?? [], timeRange: timeRange ?? null };

    if (loading && !cycle.active) {
      const requestId = crypto.randomUUID();
      refreshCycleRef.current = { active: true, requestId, startedAt: Date.now() };
      emitRefreshDebugEvent(widgetId, projectSlug, requestId, "started", 0, meta).catch(() => {
        /* fire-and-forget */
      });
      return;
    }

    if (!loading && cycle.active) {
      const durationMs = Date.now() - cycle.startedAt;
      const { requestId } = cycle;
      refreshCycleRef.current = { active: false, requestId: null, startedAt: 0 };
      const status = error ? "failed" : "completed";
      emitRefreshDebugEvent(widgetId, projectSlug, requestId, status, durationMs, {
        ...meta,
        fetchedAt,
        error,
      }).catch(() => {
        /* fire-and-forget */
      });
    }
  }, [error, fetchedAt, loading, projectSlug, sourceIds, timeRange, widgetId]);
}
