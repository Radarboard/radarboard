// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WidgetSlot } from "./";

const dashboardState = {
  projects: [],
  activeProjectSlug: null,
  timeRange: "today",
  widgetLayout: { cellA: null as string | null },
  widgetConfigs: {} as Record<string, Record<string, unknown>>,
  isEditMode: true,
  updateWidgetLayout: vi.fn(),
};

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => dashboardState,
  };
});

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useDraggable: () => ({
    attributes: {},
    listeners: undefined,
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}));

vi.mock("@radarboard/ui/app-dialog", () => {
  const component = ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children);

  return {
    APP_DIALOG_SIZES: ["sm", "md", "lg"],
    ConfirmationDialog: component,
    DialogContent: component,
    DialogDescription: component,
    DialogDestructiveButton: component,
    DialogFooter: component,
    DialogHeader: component,
    DialogTitle: component,
  };
});

vi.mock("@radarboard/ui/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));

vi.mock("../debug-events", () => ({
  emitWidgetDebugEvent: vi.fn(),
}));

vi.mock("../widget-card", () => ({
  WidgetCard: ({ children, chromeStatus }: { children?: ReactNode; chromeStatus?: string }) =>
    createElement(
      "div",
      { "data-testid": "widget-card", "data-chrome-status": chromeStatus },
      children
    ),
}));

vi.mock("../widget-picker-popover", () => ({
  WidgetPickerPopover: () => null,
}));

vi.mock("../widgets/registry", () => ({
  WIDGET_REGISTRY: new Map([
    [
      "test-widget",
      {
        id: "test-widget",
        name: "Test Widget",
        defaultConfig: {},
        component: ({
          onChromeStateChange,
        }: {
          onChromeStateChange?: (status: string) => void;
        }) => {
          useEffect(() => {
            onChromeStateChange?.("disconnected");
          }, [onChromeStateChange]);

          return createElement("div", null, "Loaded widget");
        },
      },
    ],
  ]),
}));

describe("WidgetSlot", () => {
  beforeEach(() => {
    dashboardState.widgetLayout = { cellA: null };
    dashboardState.widgetConfigs = {};
    dashboardState.updateWidgetLayout.mockReset();
  });

  it("keeps a stable hook order when a slot is filled and cleared", () => {
    const view = render(createElement(WidgetSlot, { cellId: "cellA" }));

    expect(screen.getByRole("button")).toBeTruthy();

    dashboardState.widgetLayout = { cellA: "test-widget" };
    expect(() => view.rerender(createElement(WidgetSlot, { cellId: "cellA" }))).not.toThrow();
    expect(screen.getByText("Loaded widget")).toBeTruthy();

    dashboardState.widgetLayout = { cellA: null };
    expect(() => view.rerender(createElement(WidgetSlot, { cellId: "cellA" }))).not.toThrow();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("passes disconnected chrome state from the widget into WidgetCard", () => {
    dashboardState.widgetLayout = { cellA: "test-widget" };

    render(createElement(WidgetSlot, { cellId: "cellA" }));

    return waitFor(() => {
      expect(screen.getByTestId("widget-card").getAttribute("data-chrome-status")).toBe(
        "disconnected"
      );
    });
  });
});
