import {
  reconcileDashboardWidgetLayout,
  resolveDashboardProjectView,
} from "@radarboard/hooks/dashboard-layout";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { getSortedCells } from "@radarboard/widget-engine/layouts";
import { describe, expect, it } from "vitest";

describe("resolveDashboardProjectView", () => {
  it("falls back to an overview page when a project has no saved config", () => {
    const result = resolveDashboardProjectView({
      layouts: [],
      projectLayouts: {},
      projectSlug: "goshuin-atlas",
    });

    const firstCellId = getSortedCells(result.layout.cells)[0]?.id;
    expect(result.activePage.slug).toBe("overview");
    expect(result.layout.id).toBe("single-cell");
    expect(firstCellId ? result.widgetLayout[firstCellId] : null).toBeNull();
  });

  it("resolves the saved page layout and slot map for the requested project page", () => {
    const config: WidgetLayoutConfig = {
      configs: {},
      layouts: [
        {
          id: "hero",
          name: "Hero",
          cells: [
            { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 2, colSpan: 2 },
            { id: "cell-2", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
            { id: "cell-3", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
            { id: "cell-4", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
            { id: "cell-5", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
            { id: "cell-6", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
          ],
          colSizes: [40, 30, 30],
          rowSizes: [30, 35, 35],
        },
      ],
      projectLayouts: {
        "goshuin-atlas": {
          pages: [
            {
              name: "Executive",
              slug: "executive",
              layoutId: "hero",
              widgetLayouts: {
                hero: {
                  slot1: "analytics",
                  slot2: "observability",
                  slot3: "seo",
                  slot4: "shipping",
                  slot5: "roadmap",
                  slot6: "revenue",
                },
              },
            },
          ],
        },
      },
    };

    const result = resolveDashboardProjectView({
      layouts: config.layouts,
      projectLayouts: config.projectLayouts,
      projectSlug: "goshuin-atlas",
      pageSlug: "executive",
    });

    const sortedCells = getSortedCells(result.layout.cells);
    expect(result.activePage.slug).toBe("executive");
    expect(result.layout.id).toBe("hero");
    expect(sortedCells[0] ? result.widgetLayout[sortedCells[0].id] : null).toBe("analytics");
    expect(sortedCells[5] ? result.widgetLayout[sortedCells[5].id] : null).toBe("revenue");
  });

  it("falls back to the first configured page when the requested page slug is invalid", () => {
    const result = resolveDashboardProjectView({
      layouts: [],
      projectLayouts: {
        "goshuin-atlas": {
          pages: [
            {
              name: "Executive",
              slug: "executive",
              layoutId: "basic-3x3",
              widgetLayouts: {
                "basic-3x3": {
                  slot1: "analytics",
                },
              },
            },
            {
              name: "Operations",
              slug: "operations",
              layoutId: "basic-3x3",
              widgetLayouts: {
                "basic-3x3": {
                  slot1: "shipping",
                },
              },
            },
          ],
        },
      },
      projectSlug: "goshuin-atlas",
      pageSlug: "missing-page",
    });

    const firstCellId = getSortedCells(result.layout.cells)[0]?.id;
    expect(result.activePage.slug).toBe("executive");
    expect(firstCellId ? result.widgetLayout[firstCellId] : null).toBe("analytics");
  });

  it("moves a widget into a merged cell when the layout cell ids change", () => {
    const previousLayout = {
      id: "hero",
      name: "Hero",
      cells: [
        { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [50, 50],
      rowSizes: [100],
    };
    const nextLayout = {
      ...previousLayout,
      cells: [{ id: "merged-cell", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 2 }],
    };

    const reconciled = reconcileDashboardWidgetLayout(previousLayout, nextLayout, {
      "cell-1": null,
      "cell-2": "shipping",
    });

    expect(reconciled).toEqual({ "merged-cell": "shipping" });
  });
});
