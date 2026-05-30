"use client";

import { useEffect, useMemo, useReducer } from "react";
import { formatClock, isQuickRangeActive, type TimelineBucket } from "../events-timeline-utils";

export type { TimelineBucket } from "../events-timeline-utils";

const QUICK_RANGES = [
  { id: "15m", label: "15m", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1h", ms: 60 * 60 * 1000 },
  { id: "6h", label: "6h", ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "24h", ms: 24 * 60 * 60 * 1000 },
] as const;

function BucketTooltip({ bucket, totalBuckets }: { bucket: TimelineBucket; totalBuckets: number }) {
  return (
    <div
      className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-item border border-border bg-surface-raised px-3 py-2 font-mono text-foreground-secondary text-w-sm shadow-popover"
      style={{ left: `${((bucket.index + 0.5) / totalBuckets) * 100}%` }}
    >
      <div>
        {formatClock(bucket.startMs)} to {formatClock(bucket.endMs)}
      </div>
      <div className="mt-1 text-dim/80">{bucket.count} events</div>
      {(bucket.errorCount > 0 || bucket.warnCount > 0) && (
        <div className="mt-1 flex gap-2">
          {bucket.errorCount > 0 && (
            <span className="text-destructive">{bucket.errorCount} errors</span>
          )}
          {bucket.warnCount > 0 && (
            <span className="text-warning">{bucket.warnCount} warnings</span>
          )}
        </div>
      )}
    </div>
  );
}

function isBucketSelected(
  bucket: TimelineBucket,
  activeRange: { start: number; end: number } | null,
  selectedFromMs: number | null,
  selectedToMs: number | null
): boolean {
  if (activeRange != null) {
    return bucket.index >= activeRange.start && bucket.index <= activeRange.end;
  }
  if (selectedFromMs != null && selectedToMs != null) {
    return bucket.endMs >= selectedFromMs && bucket.startMs <= selectedToMs;
  }
  return false;
}

function getBucketBarColor(bucket: TimelineBucket): string {
  if (bucket.errorCount > 0) return "bg-destructive/80";
  if (bucket.warnCount > 0) return "bg-warning/80";
  return "bg-accent/80";
}

type TimelineState = {
  dragCurrentIndex: number | null;
  dragStartIndex: number | null;
  hoveredBucketIndex: number | null;
};

type TimelineAction =
  | { type: "drag-clear" }
  | { type: "drag-start"; index: number }
  | { type: "drag-update"; index: number | null }
  | { type: "hover"; index: number | null };

function timelineStateReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "drag-clear":
      return {
        ...state,
        dragCurrentIndex: null,
        dragStartIndex: null,
      };
    case "drag-start":
      return {
        ...state,
        dragCurrentIndex: action.index,
        dragStartIndex: action.index,
      };
    case "drag-update":
      return {
        ...state,
        dragCurrentIndex: action.index,
      };
    case "hover":
      return {
        ...state,
        hoveredBucketIndex: action.index,
      };
    default:
      return state;
  }
}

export function EventsTimeline({
  buckets,
  totalEvents,
  from,
  to,
  onRangeChange,
}: {
  buckets: TimelineBucket[];
  totalEvents: number;
  from: string | null;
  to: string | null;
  onRangeChange: (from: string | null, to: string | null) => void;
}) {
  const [state, dispatch] = useReducer(timelineStateReducer, {
    dragCurrentIndex: null,
    dragStartIndex: null,
    hoveredBucketIndex: null,
  });
  const { dragCurrentIndex, dragStartIndex, hoveredBucketIndex } = state;
  const maxCount = useMemo(() => Math.max(1, ...buckets.map((bucket) => bucket.count)), [buckets]);

  const activeRange = useMemo(() => {
    if (dragStartIndex == null || dragCurrentIndex == null) return null;
    return {
      start: Math.min(dragStartIndex, dragCurrentIndex),
      end: Math.max(dragStartIndex, dragCurrentIndex),
    };
  }, [dragCurrentIndex, dragStartIndex]);

  useEffect(() => {
    if (dragStartIndex == null) return;

    function handlePointerUp() {
      if (!activeRange) {
        dispatch({ type: "drag-clear" });
        return;
      }
      const startBucket = buckets[activeRange.start];
      const endBucket = buckets[activeRange.end];
      if (startBucket && endBucket) {
        onRangeChange(
          new Date(startBucket.startMs).toISOString(),
          new Date(endBucket.endMs).toISOString()
        );
      }
      dispatch({ type: "drag-clear" });
    }

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [activeRange, buckets, dragStartIndex, onRangeChange]);

  if (buckets.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface px-4 py-3 font-mono text-dim text-w-sm">
        No events in the current window.
      </div>
    );
  }

  const selectedFromMs = from ? Date.parse(from) : null;
  const selectedToMs = to ? Date.parse(to) : null;
  const hoveredBucket = hoveredBucketIndex != null ? (buckets[hoveredBucketIndex] ?? null) : null;
  const rangeStartMs = buckets[0]?.startMs ?? null;
  const rangeEndMs = buckets[buckets.length - 1]?.endMs ?? null;

  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="font-mono text-dim text-w-sm">
          <div>Timeline</div>
          <div className="mt-1">
            {formatClock(rangeStartMs ?? undefined)} to {formatClock(rangeEndMs ?? undefined)}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {QUICK_RANGES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (!rangeEndMs || !rangeStartMs) return;
                const startMs = Math.max(rangeStartMs, rangeEndMs - preset.ms);
                onRangeChange(new Date(startMs).toISOString(), new Date(rangeEndMs).toISOString());
              }}
              className={`rounded-item border px-2.5 py-1 font-mono text-w-sm transition-colors ${
                isQuickRangeActive(selectedFromMs, selectedToMs, rangeEndMs, preset.ms)
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-border bg-surface text-dim hover:text-foreground-secondary"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onRangeChange(null, null)}
            className={`rounded-item border px-2.5 py-1 font-mono text-w-sm transition-colors ${
              selectedFromMs == null || selectedToMs == null
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-surface text-dim hover:text-foreground-secondary"
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="relative flex h-16 select-none items-end gap-1">
        {buckets.map((bucket) => {
          const heightPct = Math.max(8, Math.round((bucket.count / maxCount) * 100));
          const isSelected = isBucketSelected(bucket, activeRange, selectedFromMs, selectedToMs);

          return (
            <button
              key={bucket.index}
              type="button"
              onPointerDown={() => {
                dispatch({ type: "drag-start", index: bucket.index });
              }}
              onPointerEnter={() => {
                dispatch({ type: "hover", index: bucket.index });
                if (dragStartIndex != null) {
                  dispatch({ type: "drag-update", index: bucket.index });
                }
              }}
              onPointerLeave={() => {
                if (hoveredBucketIndex === bucket.index) {
                  dispatch({ type: "hover", index: null });
                }
              }}
              onDoubleClick={() => onRangeChange(null, null)}
              className={`relative flex-1 rounded-item transition-colors ${
                isSelected ? "bg-accent/10" : "bg-surface-raised hover:bg-secondary"
              }`}
              style={{ height: `${heightPct}%` }}
            >
              <span className={`absolute inset-0 rounded-item ${getBucketBarColor(bucket)}`} />
            </button>
          );
        })}

        {Boolean(hoveredBucket) && (
          <BucketTooltip bucket={hoveredBucket!} totalBuckets={buckets.length} />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-dim text-w-sm">
        <span>{totalEvents} events in timeline</span>
        <span>Drag to select · Quick ranges · Double-click to clear</span>
      </div>
    </div>
  );
}
