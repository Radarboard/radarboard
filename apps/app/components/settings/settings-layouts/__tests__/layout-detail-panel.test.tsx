// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { LayoutDefinition } from "@radarboard/types/database";
import { TooltipProvider } from "@radarboard/ui/tooltip";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LayoutDetailPanel } from "../layout-detail-panel";

vi.mock("@radarboard/widget-engine/resize-handle", () => ({
  ResizeHandle: () => <div data-testid="resize-handle" />,
  SegmentResizeHandle: () => <div data-testid="segment-resize-handle" />,
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  getWidget: vi.fn((id: string) => {
    const labels: Record<string, { name: string }> = {
      analytics: { name: "Analytics" },
      revenue: { name: "Revenue" },
      shipping: { name: "Release Activity" },
    };
    return labels[id];
  }),
}));

const BASIC_LAYOUT: LayoutDefinition = {
  id: "basic-3x3",
  name: "Basic 3×3",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [33.33, 33.33, 33.34],
  rowSizes: [33.33, 33.33, 33.34],
};

const EDITABLE_LAYOUT: LayoutDefinition = {
  id: "layout-2x2",
  name: "Two by Two",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [50, 50],
  rowSizes: [50, 50],
};

function renderPanel(overrides: Partial<ComponentProps<typeof LayoutDetailPanel>> = {}) {
  return render(
    <TooltipProvider>
      <LayoutDetailPanel
        selectedLayout={EDITABLE_LAYOUT}
        isDefault={false}
        selectedUsageCount={1}
        editorNotice={null}
        deleteDialogOpen={false}
        onDeleteDialogOpenChange={vi.fn()}
        onUpdateName={vi.fn()}
        onUpdateLayout={vi.fn()}
        onDuplicateLayout={vi.fn()}
        onBalanceColumns={vi.fn()}
        onBalanceRows={vi.fn()}
        onBalanceTracks={vi.fn()}
        onResetLayout={vi.fn()}
        onDelete={vi.fn()}
        assignmentTargets={[
          {
            key: "__all__:overview",
            ownerSlug: "__all__",
            ownerName: "All Projects",
            pageSlug: "overview",
            pageName: "Overview",
            currentLayoutId: EDITABLE_LAYOUT.id,
            currentLayoutName: EDITABLE_LAYOUT.name,
            currentAssignments: {
              "cell-1": "analytics",
              "cell-2": "revenue",
              "cell-3": null,
              "cell-4": null,
            },
          },
          {
            key: "radarboard:growth",
            ownerSlug: "radarboard",
            ownerName: "Radarboard",
            pageSlug: "growth",
            pageName: "Growth",
            currentLayoutId: BASIC_LAYOUT.id,
            currentLayoutName: BASIC_LAYOUT.name,
            currentAssignments: {
              "cell-1": null,
              "cell-2": null,
              "cell-3": null,
              "cell-4": null,
            },
          },
        ]}
        defaultAssignmentTargetKey="__all__:overview"
        onAssignLayoutToTarget={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>
  );
}

describe("LayoutDetailPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("matches the active current-page assignment state", () => {
    const { container } = renderPanel();

    expect(screen.getByText("Layout Name")).toBeInTheDocument();
    expect(screen.getByText("Assign Layout")).toBeInTheDocument();
    expect(screen.getByText("Layout Canvas")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("matches the inactive assignment warning state", () => {
    const { container } = renderPanel({
      selectedUsageCount: 3,
      editorNotice: "2 cells removed. Pages using this layout may now have unassigned widgets.",
      defaultAssignmentTargetKey: "radarboard:growth",
    });

    expect(screen.getByText(/is not assigned to Growth/i)).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("matches the destructive removal modal state", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Remove column 2" }));

    expect(screen.getByText("Review Column Removal")).toBeInTheDocument();
    expect(document.body).toMatchSnapshot();
  }, 30_000);

  it("opens the removal modal with a dropped widget preview and cancels cleanly", () => {
    const onUpdateLayout = vi.fn();
    renderPanel({ onUpdateLayout });

    fireEvent.click(screen.getByRole("button", { name: "Remove column 2" }));

    expect(screen.getByText("Assignment Preview")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onUpdateLayout).not.toHaveBeenCalled();
  });

  it("confirms row removal and applies the layout update", () => {
    const onUpdateLayout = vi.fn();
    renderPanel({
      onUpdateLayout,
      assignmentTargets: [
        {
          key: "__all__:overview",
          ownerSlug: "__all__",
          ownerName: "All Projects",
          pageSlug: "overview",
          pageName: "Overview",
          currentLayoutId: EDITABLE_LAYOUT.id,
          currentLayoutName: EDITABLE_LAYOUT.name,
          currentAssignments: {
            "cell-1": "analytics",
            "cell-2": null,
            "cell-3": "shipping",
            "cell-4": null,
          },
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove row 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));

    expect(onUpdateLayout).toHaveBeenCalledTimes(1);
    const [, meta] = onUpdateLayout.mock.calls[0] ?? [];
    expect(meta?.removedCellIds?.length).toBeGreaterThan(0);
  });
});
