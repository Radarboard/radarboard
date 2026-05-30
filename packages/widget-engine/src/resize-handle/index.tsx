"use client";

import type React from "react";
import { type RefObject, useCallback, useRef } from "react";

export type ResizeAxis = "vertical" | "horizontal";

interface ResizeHandleProps {
  /**
   * "vertical"   — a column-gap handle; dragging left/right changes column widths.
   * "horizontal" — a row-gap handle; dragging up/down changes row heights.
   */
  axis: ResizeAxis;
  /**
   * Which gap this handle sits in: 0 = between track 0 & 1, 1 = between track 1 & 2, etc.
   */
  index: number;
  /**
   * Current track sizes (percentages summing to 100) for the relevant axis.
   * Used to position the handle precisely.
   */
  sizes: number[];
  /**
   * Ref to the container element. Used to measure pixel dimensions at drag start.
   * For vertical handles, offsetWidth is used; for horizontal, offsetHeight.
   */
  containerRef: RefObject<HTMLDivElement | null>;
  /**
   * Called continuously during drag with the new proposed sizes.
   * The caller is responsible for applying them (e.g. as CSS custom properties).
   */
  onResize: (newSizes: number[]) => void;
  /**
   * Called once when the drag ends (pointer up / cancel).
   * Use this to persist the final sizes.
   */
  onResizeEnd: (finalSizes: number[]) => void;
}

const MIN_PCT = 10;

function clampSizes(sizes: number[], index: number, deltaPct: number) {
  if (index < 0 || index >= sizes.length - 1) return sizes;

  const next = [...sizes];
  const neighbor = index + 1;

  const currentA = next[index] ?? 0;
  const currentB = next[neighbor] ?? 0;

  const newA = currentA + deltaPct;
  const newB = currentB - deltaPct;

  if (newA >= MIN_PCT && newB >= MIN_PCT) {
    next[index] = newA;
    next[neighbor] = newB;
  }
  return next;
}

export function ResizeHandle({
  axis,
  index,
  sizes,
  containerRef,
  onResize,
  onResizeEnd,
}: ResizeHandleProps) {
  const isVertical = axis === "vertical";

  // Position the handle at the border between track `index` and `index + 1`
  const offsetPct = sizes.slice(0, index + 1).reduce((sum, size) => sum + size, 0);

  const dragState = useRef<{
    startPos: number;
    startSizes: number[];
    currentSizes: number[];
    containerSize: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      // Measure container size at drag start for accurate px → % conversion
      const container = containerRef.current;
      const containerSize = isVertical
        ? (container?.offsetWidth ?? 0)
        : (container?.offsetHeight ?? 0);

      dragState.current = {
        startPos: isVertical ? e.clientX : e.clientY,
        startSizes: [...sizes],
        currentSizes: [...sizes],
        containerSize,
      };
    },
    [isVertical, sizes, containerRef]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragState.current;
      if (!state || state.containerSize === 0) return;

      const pos = isVertical ? e.clientX : e.clientY;
      const rawDelta = pos - state.startPos;
      const deltaPct = (rawDelta / state.containerSize) * 100;
      const newSizes = clampSizes(state.startSizes, index, deltaPct);
      state.currentSizes = newSizes;
      onResize(newSizes);
    },
    [isVertical, index, onResize]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragState.current) return;
    onResizeEnd(dragState.current.currentSizes);
    dragState.current = null;
  }, [onResizeEnd]);

  // The handle is an 8px-wide/tall strip centered on the gap between tracks.
  const handleThickness = 8;
  const halfThickness = handleThickness / 2;

  const style: React.CSSProperties = isVertical
    ? {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `calc(${offsetPct}% - ${halfThickness}px)`,
        width: `${handleThickness}px`,
        cursor: "col-resize",
        pointerEvents: "auto",
        zIndex: 10,
      }
    : {
        position: "absolute",
        left: 0,
        right: 0,
        top: `calc(${offsetPct}% - ${halfThickness}px)`,
        height: `${handleThickness}px`,
        cursor: "row-resize",
        pointerEvents: "auto",
        zIndex: 10,
      };

  return (
    <div
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="group"
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-35 transition-interactive group-hover:opacity-100">
        <div
          style={
            isVertical
              ? { width: "1px", height: "100%", backgroundColor: "var(--color-accent)" }
              : { height: "1px", width: "100%", backgroundColor: "var(--color-accent)" }
          }
        />
      </div>
    </div>
  );
}

interface SegmentResizeHandleProps {
  axis: ResizeAxis;
  containerRef: RefObject<HTMLDivElement | null>;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  onResizeStart?: () => void;
  onResize: (deltaPct: number) => void;
  onResizeEnd: () => void;
}

export function SegmentResizeHandle({
  axis,
  containerRef,
  leftPct,
  topPct,
  widthPct,
  heightPct,
  onResizeStart,
  onResize,
  onResizeEnd,
}: SegmentResizeHandleProps) {
  const isVertical = axis === "vertical";
  const dragState = useRef<{
    startPos: number;
    containerSize: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      const container = containerRef.current;
      const containerSize = isVertical
        ? (container?.offsetWidth ?? 0)
        : (container?.offsetHeight ?? 0);

      dragState.current = {
        startPos: isVertical ? event.clientX : event.clientY,
        containerSize,
      };
      onResizeStart?.();
    },
    [containerRef, isVertical, onResizeStart]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = dragState.current;
      if (!state || state.containerSize === 0) return;

      const position = isVertical ? event.clientX : event.clientY;
      const deltaPct = ((position - state.startPos) / state.containerSize) * 100;
      onResize(deltaPct);
    },
    [isVertical, onResize]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    onResizeEnd();
  }, [onResizeEnd]);

  const handleThickness = 8;
  const halfThickness = handleThickness / 2;
  const style: React.CSSProperties = isVertical
    ? {
        position: "absolute",
        left: `calc(${leftPct}% - ${halfThickness}px)`,
        top: `${topPct}%`,
        width: `${handleThickness}px`,
        height: `${heightPct}%`,
        cursor: "col-resize",
        pointerEvents: "auto",
        zIndex: 10,
      }
    : {
        position: "absolute",
        left: `${leftPct}%`,
        top: `calc(${topPct}% - ${halfThickness}px)`,
        width: `${widthPct}%`,
        height: `${handleThickness}px`,
        cursor: "row-resize",
        pointerEvents: "auto",
        zIndex: 10,
      };

  return (
    <div
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="group"
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-35 transition-interactive group-hover:opacity-100">
        <div
          style={
            isVertical
              ? { width: "1px", height: "100%", backgroundColor: "var(--color-accent)" }
              : { height: "1px", width: "100%", backgroundColor: "var(--color-accent)" }
          }
        />
      </div>
    </div>
  );
}
