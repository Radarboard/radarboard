import { createDefaultDashboardWidgetLayout } from "@radarboard/hooks/dashboard-layout";
import { BASIC_3X3 } from "@radarboard/widget-engine/layouts";
import { describe, expect, it } from "vitest";
import {
  getPreferredCellId,
  getVisibleCellIds,
  getWidgetToVisibleCellIdMap,
  placeWidgetInVisibleCells,
} from "../";

describe("settings-widgets-utils", () => {
  it("maps enabled widgets from modern cell-based layouts", () => {
    const widgetLayout = createDefaultDashboardWidgetLayout(BASIC_3X3);
    const visibleCellIds = getVisibleCellIds(BASIC_3X3);
    const widgetToCellId = getWidgetToVisibleCellIdMap(widgetLayout, visibleCellIds);

    expect(widgetToCellId.size).toBe(0);
    expect(widgetToCellId.has("sponsorship")).toBe(false);
  });

  it("places widgets into visible cells using their preferred slot position", () => {
    const widgetLayout = createDefaultDashboardWidgetLayout(BASIC_3X3);
    const visibleCellIds = getVisibleCellIds(BASIC_3X3);
    widgetLayout["cell-7"] = "pulls";

    const nextLayout = placeWidgetInVisibleCells(
      widgetLayout,
      "sponsorship",
      visibleCellIds,
      getPreferredCellId(visibleCellIds, "slot7")
    );

    expect(nextLayout["cell-7"]).toBe("sponsorship");
    expect(nextLayout["cell-8"]).toBeNull();
  });
});
