"use client";

import { cn } from "@radarboard/utils/cn";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { useLayoutMode } from "./layout-context";
import { ThreePaneDrawerAdapter } from "./three-pane-drawer-adapter";

interface ThreePaneWorkspaceProps {
  sidebar: React.ReactNode;
  list: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
  sidebarClassName?: string;
  listClassName?: string;
  detailClassName?: string;
  initialSidebarWidth?: number;
  initialListWidth?: number;
  minSidebarWidth?: number;
  minListWidth?: number;
  minDetailWidth?: number;
  /** Label for the sidebar tab in drawer mode. */
  sidebarTabLabel?: string;
  /** Label for the list tab in drawer mode. */
  listTabLabel?: string;
  /**
   * Stable key identifying the current detail content (e.g. selected item ID).
   * Used in drawer mode to detect when a new item is selected and open the
   * detail modal. Required for correct drawer behavior.
   */
  detailKey?: string | null;
}

export function ThreePaneWorkspace({
  sidebar,
  list,
  detail,
  className,
  sidebarClassName,
  listClassName,
  detailClassName,
  initialSidebarWidth = 280,
  initialListWidth = 360,
  minSidebarWidth = 220,
  minListWidth = 280,
  minDetailWidth = 420,
  sidebarTabLabel,
  listTabLabel,
  detailKey,
}: ThreePaneWorkspaceProps) {
  const layoutMode = useLayoutMode();

  // In drawer mode, delegate to the tabbed adapter
  if (layoutMode === "drawer") {
    return (
      <ThreePaneDrawerAdapter
        sidebar={sidebar}
        list={list}
        detail={detail}
        className={className}
        sidebarClassName={sidebarClassName}
        listClassName={listClassName}
        detailClassName={detailClassName}
        sidebarTabLabel={sidebarTabLabel}
        listTabLabel={listTabLabel}
        detailKey={detailKey}
      />
    );
  }

  // Fullscreen: original 3-column resizable layout
  return (
    <ThreePaneColumns
      sidebar={sidebar}
      list={list}
      detail={detail}
      className={className}
      sidebarClassName={sidebarClassName}
      listClassName={listClassName}
      detailClassName={detailClassName}
      initialSidebarWidth={initialSidebarWidth}
      initialListWidth={initialListWidth}
      minSidebarWidth={minSidebarWidth}
      minListWidth={minListWidth}
      minDetailWidth={minDetailWidth}
    />
  );
}

/** The original 3-column resizable layout, extracted for clarity. */
function ThreePaneColumns({
  sidebar,
  list,
  detail,
  className,
  sidebarClassName,
  listClassName,
  detailClassName,
  initialSidebarWidth = 280,
  initialListWidth = 360,
  minSidebarWidth = 220,
  minListWidth = 280,
  minDetailWidth = 420,
}: Omit<ThreePaneWorkspaceProps, "sidebarTabLabel" | "listTabLabel">) {
  const initialSidebarWidthRef = useRef(initialSidebarWidth);
  const initialListWidthRef = useRef(initialListWidth);
  const [sidebarWidth, setSidebarWidth] = useState(() => initialSidebarWidthRef.current);
  const [listWidth, setListWidth] = useState(() => initialListWidthRef.current);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const beginResize = useCallback(
    (pane: "sidebar" | "list", startX: number) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const workspaceWidth = workspace.getBoundingClientRect().width;
      const startSidebarWidth = sidebarWidth;
      const startListWidth = listWidth;

      function clampWidths(nextSidebarWidth: number, nextListWidth: number) {
        const maxSidebarWidth = Math.max(
          minSidebarWidth,
          workspaceWidth - startListWidth - minDetailWidth
        );
        const clampedSidebarWidth = Math.min(
          Math.max(nextSidebarWidth, minSidebarWidth),
          maxSidebarWidth
        );

        const maxListWidth = Math.max(
          minListWidth,
          workspaceWidth - clampedSidebarWidth - minDetailWidth
        );
        const clampedListWidth = Math.min(Math.max(nextListWidth, minListWidth), maxListWidth);

        return {
          sidebar: clampedSidebarWidth,
          list: clampedListWidth,
        };
      }

      function handlePointerMove(event: PointerEvent) {
        const deltaX = event.clientX - startX;
        const next =
          pane === "sidebar"
            ? clampWidths(startSidebarWidth + deltaX, startListWidth)
            : clampWidths(startSidebarWidth, startListWidth + deltaX);

        setSidebarWidth(next.sidebar);
        setListWidth(next.list);
      }

      function cleanup() {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", cleanup);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", cleanup);
    },
    [listWidth, minDetailWidth, minListWidth, minSidebarWidth, sidebarWidth]
  );

  return (
    <div ref={workspaceRef} className={cn("flex h-full min-h-0 overflow-hidden", className)}>
      <aside
        className={cn("min-h-0 min-w-0 shrink-0", sidebarClassName)}
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </aside>

      <ColumnResizeHandle onPointerDown={(event) => beginResize("sidebar", event.clientX)} />

      <section
        className={cn(detail ? "shrink-0" : "flex-1", "min-h-0 min-w-0", listClassName)}
        style={detail ? { width: listWidth } : undefined}
      >
        {list}
      </section>

      {Boolean(detail) && (
        <>
          <ColumnResizeHandle onPointerDown={(event) => beginResize("list", event.clientX)} />

          <section
            className={cn("min-h-0 min-w-0 flex-1", detailClassName)}
            style={{ minWidth: minDetailWidth }}
          >
            {detail}
          </section>
        </>
      )}
    </div>
  );
}

function ColumnResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="relative z-10 w-0 shrink-0">
      <button
        type="button"
        aria-label="Resize columns"
        onPointerDown={onPointerDown}
        className="group absolute inset-y-0 -left-2 w-4 cursor-col-resize bg-transparent focus:outline-none"
        style={{ cursor: "col-resize" }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-surface-raised group-hover:bg-accent"
          style={{ cursor: "col-resize" }}
        />
      </button>
    </div>
  );
}
