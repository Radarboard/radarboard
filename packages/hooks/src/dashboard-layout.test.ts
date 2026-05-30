import type { LayoutDefinition, ProjectLayoutConfig } from "@radarboard/types/database";
import { describe, expect, it } from "vitest";
import {
  BASIC_3X3_DASHBOARD_LAYOUT,
  createDefaultDashboardPage,
  normalizeDashboardWidgetLayout,
  previewDashboardLayoutChange,
  reconcileDashboardWidgetLayout,
  resolveDashboardProjectView,
} from "./dashboard-layout";

const previousLayout: LayoutDefinition = {
  id: "two-cells",
  name: "Two Cells",
  cells: [
    { id: "left", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "right", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [50, 50],
  rowSizes: [100],
};

const nextLayout: LayoutDefinition = {
  id: "hero",
  name: "Hero",
  cells: [{ id: "hero", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 2 }],
  colSizes: [100],
  rowSizes: [100],
};

const previousFourByFourLayout: LayoutDefinition = {
  id: "basic-4x4",
  name: "Basic 4×4",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 0, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 1, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-10", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-11", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-12", rowStart: 2, colStart: 3, rowSpan: 1, colSpan: 1 },
    { id: "cell-13", rowStart: 3, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-14", rowStart: 3, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-15", rowStart: 3, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-16", rowStart: 3, colStart: 3, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [25, 25, 25, 25],
  rowSizes: [25, 25, 25, 25],
};

describe("dashboard layout helpers", () => {
  it("maps legacy slot assignments onto sorted modern cell ids", () => {
    expect(
      normalizeDashboardWidgetLayout(BASIC_3X3_DASHBOARD_LAYOUT, {
        slot2: "bookmarks",
      })
    ).toMatchObject({
      "cell-1": null,
      "cell-2": "bookmarks",
    });
  });

  it("reconciles widgets into overlapping cells when the layout changes", () => {
    expect(
      reconcileDashboardWidgetLayout(previousLayout, nextLayout, {
        left: "activity",
        right: null,
      })
    ).toEqual({
      hero: "activity",
    });
  });

  it("reports preserved and dropped widgets when a layout change would lose assignments", () => {
    const preview = previewDashboardLayoutChange(previousLayout, nextLayout, {
      left: "activity",
      right: "shipping",
    });

    expect(preview.assignedWidgets).toEqual([
      { cellId: "left", widgetId: "activity" },
      { cellId: "right", widgetId: "shipping" },
    ]);
    expect(preview.preservedCellIds).toEqual(["left"]);
    expect(preview.droppedCellIds).toEqual(["right"]);
    expect(preview.keepCapacity).toBe(1);
  });

  it("builds curated next assignments from an allowed keep set", () => {
    const preview = previewDashboardLayoutChange(
      previousLayout,
      nextLayout,
      {
        left: "activity",
        right: "shipping",
      },
      new Set(["right"])
    );

    expect(preview.preservedCellIds).toEqual(["right"]);
    expect(preview.droppedCellIds).toEqual([]);
    expect(preview.nextAssignments).toEqual({
      hero: "shipping",
    });
  });

  it("keeps explicitly selected widgets even when their old 4x4 cells do not overlap the new 3x3 layout", () => {
    const preview = previewDashboardLayoutChange(
      previousFourByFourLayout,
      BASIC_3X3_DASHBOARD_LAYOUT,
      {
        "cell-12": "downloads",
        "cell-16": "seo",
      },
      new Set(["cell-12", "cell-16"])
    );

    expect(preview.preservedCellIds).toEqual(["cell-12", "cell-16"]);
    expect(preview.droppedCellIds).toEqual([]);
    expect(Object.values(preview.nextAssignments).filter((widgetId) => widgetId !== null)).toEqual([
      "downloads",
      "seo",
    ]);
  });

  it("resolves pages and active widget layout from project config", () => {
    const projectLayouts: Record<string, ProjectLayoutConfig> = {
      radarboard: {
        pages: [
          createDefaultDashboardPage(
            {
              name: "Home",
              slug: "home",
              layoutId: BASIC_3X3_DASHBOARD_LAYOUT.id,
              widgetLayouts: {
                [BASIC_3X3_DASHBOARD_LAYOUT.id]: { "cell-1": "status-page" },
              },
            },
            [BASIC_3X3_DASHBOARD_LAYOUT]
          ),
        ],
      },
    };

    const resolved = resolveDashboardProjectView({
      layouts: [BASIC_3X3_DASHBOARD_LAYOUT],
      projectLayouts,
      projectSlug: "radarboard",
      pageSlug: "home",
    });

    expect(resolved.activePageSlug).toBe("home");
    expect(resolved.layoutId).toBe(BASIC_3X3_DASHBOARD_LAYOUT.id);
    expect(resolved.widgetLayout["cell-1"]).toBe("status-page");
  });
});
