import type { LayoutCell, LayoutDefinition } from "@radarboard/types/database";
import {
  generateGridTemplateAreas,
  generateStackedGridAreas,
  getGridAreaName,
  getLayoutDimensions,
  getSortedCells,
  resolveColSizes,
  resolveRowSizes,
  sizesToGridTemplate,
} from "@radarboard/widget-engine/layouts";
import {
  type CSSProperties,
  createElement,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";

function buildOverlayGridStyle(layout: LayoutDefinition, showTicker: boolean): CSSProperties {
  const { colCount } = getLayoutDimensions(layout);
  const widgetAreas = generateGridTemplateAreas(layout);
  const tickerRow = `"${Array.from({ length: colCount }, () => "ticker").join(" ")}"`;

  return {
    gridTemplateColumns: sizesToGridTemplate(resolveColSizes(layout)),
    gridTemplateRows: showTicker
      ? `${sizesToGridTemplate(resolveRowSizes(layout))} auto`
      : sizesToGridTemplate(resolveRowSizes(layout)),
    gridTemplateAreas: showTicker ? `${widgetAreas} ${tickerRow}` : widgetAreas,
  };
}

function buildStackedOverlayStyle(
  areaNames: string[],
  columns: number,
  rowSize: string,
  showTicker: boolean
): CSSProperties {
  const widgetAreas = generateStackedGridAreas(areaNames, columns);
  const rowCount = Math.ceil(areaNames.length / columns);
  const tickerArea = `"${Array.from({ length: columns }, () => "ticker").join(" ")}"`;

  return {
    gridTemplateColumns: Array.from({ length: columns }, () => "minmax(0, 1fr)").join(" "),
    gridTemplateRows: `${Array.from({ length: rowCount }, () => rowSize).join(" ")}${showTicker ? " auto" : ""}`,
    gridTemplateAreas: showTicker ? `${widgetAreas} ${tickerArea}` : widgetAreas,
  };
}

function buildResponsiveOverlayStyle(
  layout: LayoutDefinition,
  areaNames: string[],
  viewportWidth: number | null,
  showTicker: boolean
): CSSProperties {
  if (viewportWidth !== null && viewportWidth <= 600) {
    return buildStackedOverlayStyle(areaNames, 1, "minmax(250px, auto)", showTicker);
  }

  if (viewportWidth !== null && viewportWidth <= 900) {
    return buildStackedOverlayStyle(areaNames, 2, "minmax(220px, 1fr)", showTicker);
  }

  return buildOverlayGridStyle(layout, showTicker);
}

function useViewportWidth(): number | null {
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return viewportWidth;
}

function line(className: string) {
  return createElement("div", { className });
}

function renderCellDetail(cell: LayoutCell) {
  const isLarge = cell.rowSpan > 1 || cell.colSpan > 1;

  if (isLarge) {
    return createElement(
      "div",
      { className: "space-y-3" },
      createElement(
        "div",
        { className: "grid grid-cols-2 gap-2" },
        line("h-16 rounded-panel border border-border/30 bg-secondary/20"),
        line("h-16 rounded-panel border border-border/30 bg-secondary/20")
      ),
      createElement(
        "div",
        { className: "space-y-2" },
        line("h-2.5 w-full rounded-full bg-secondary/40"),
        line("h-2.5 w-5/6 rounded-full bg-secondary/40"),
        line("h-2.5 w-2/3 rounded-full bg-secondary/20")
      )
    );
  }

  return createElement(
    "div",
    { className: "space-y-2" },
    line("h-10 rounded-panel border border-border/30 bg-secondary/20"),
    line("h-2.5 w-full rounded-full bg-secondary/40"),
    line("h-2.5 w-3/4 rounded-full bg-secondary/40"),
    line("h-2.5 w-1/2 rounded-full bg-secondary/20")
  );
}

export function ProjectSwitchSkeletonOverlay({
  layout,
  projectName,
  showTicker,
}: {
  layout: LayoutDefinition;
  projectName: string;
  showTicker: boolean;
}): ReactElement {
  const viewportWidth = useViewportWidth();
  const slots = useMemo(
    () =>
      getSortedCells(layout.cells).map((cell) => ({ cell, areaName: getGridAreaName(cell.id) })),
    [layout.cells]
  );
  const areaNames = useMemo(() => slots.map((slot) => slot.areaName), [slots]);
  const overlayStyle = useMemo(
    () => buildResponsiveOverlayStyle(layout, areaNames, viewportWidth, showTicker),
    [areaNames, layout, showTicker, viewportWidth]
  );

  return createElement(
    "div",
    {
      "aria-hidden": "true",
      "data-testid": "project-switch-skeleton-overlay",
      className:
        "dashboard-grid-shell pointer-events-auto absolute inset-0 z-20 grid overflow-hidden bg-[var(--grid-line)]/80 transition-opacity duration-150",
      style: {
        ...overlayStyle,
        gap: "var(--dashboard-cell-gap, 6px)",
      },
    },
    createElement(
      "div",
      {
        className:
          "pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border/40 bg-background/80 px-3 py-1.5 font-mono text-dim text-w-sm uppercase tracking-[0.18em] shadow-lg",
      },
      createElement("span", {
        className: "h-1.5 w-1.5 rounded-full bg-foreground/80 motion-safe:animate-pulse",
      }),
      `Loading ${projectName}`
    ),
    ...slots.map(({ cell, areaName }) =>
      createElement(
        "div",
        {
          key: cell.id,
          "data-testid": "project-switch-skeleton-card",
          className:
            "dashboard-cell skeleton-shimmer flex flex-col justify-between bg-surface px-4 py-4",
          style: { gridArea: areaName },
        },
        createElement(
          "div",
          { className: "flex items-start justify-between gap-3" },
          createElement(
            "div",
            { className: "space-y-2" },
            line("h-2.5 w-24 rounded-full bg-secondary/40"),
            line("h-2 w-16 rounded-full bg-secondary/20")
          ),
          line("h-7 w-7 rounded-full border border-border/30 bg-secondary/20")
        ),
        renderCellDetail(cell)
      )
    ),
    showTicker
      ? createElement(
          "div",
          { className: "dashboard-ticker bg-surface px-4 py-3" },
          createElement(
            "div",
            { className: "skeleton-shimmer flex h-full items-center gap-3" },
            line("h-5 w-16 rounded-full border border-border/30 bg-secondary/20"),
            line("h-2.5 w-32 rounded-full bg-secondary/40"),
            line("h-2.5 w-48 rounded-full bg-secondary/40"),
            line("h-2.5 w-28 rounded-full bg-secondary/20")
          )
        )
      : null
  );
}
