// @vitest-environment jsdom
import type { LayoutDefinition } from "@radarboard/types/database";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ProjectSwitchSkeletonOverlay } from "../";

const HERO_LAYOUT: LayoutDefinition = {
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
};

describe("ProjectSwitchSkeletonOverlay", () => {
  it("renders target-layout skeleton cards and the loading label", () => {
    render(
      createElement(ProjectSwitchSkeletonOverlay, {
        layout: HERO_LAYOUT,
        projectName: "Goshuin Atlas",
        showTicker: true,
      })
    );

    const overlay = screen.getByTestId("project-switch-skeleton-overlay");

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain("dashboard-grid-shell");
    expect(screen.getByText("Loading Goshuin Atlas")).toBeTruthy();
    expect(screen.getAllByTestId("project-switch-skeleton-card")).toHaveLength(
      HERO_LAYOUT.cells.length
    );
  });
});
