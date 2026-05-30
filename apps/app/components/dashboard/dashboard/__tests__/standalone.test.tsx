// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardStandalone } from "../standalone";

const useDashboardMock = vi.fn();
const useCredentialsMock = vi.fn();
const projectTabsMock = vi.fn();
const topBarMock = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => useDashboardMock(),
  };
});

vi.mock("@radarboard/hooks/use-credentials", () => ({
  useCredentials: () => useCredentialsMock(),
}));

vi.mock("@radarboard/plugin-sdk/runtime/plugin-dock", () => ({
  PluginSidebar: () => null,
}));

vi.mock("@radarboard/widget-engine/page-tabs", () => ({
  PageTabs: () => null,
}));

vi.mock("@radarboard/widget-engine/project-tabs", () => ({
  ProjectTabs: (props: unknown) => {
    projectTabsMock(props);
    return createElement("div", { "data-testid": "project-tabs" });
  },
}));

vi.mock("@radarboard/widget-engine/top-bar", () => ({
  TopBar: (props: { projectTabsSlot?: ReactNode }) => {
    topBarMock(props);
    return createElement("div", { "data-testid": "top-bar" }, props.projectTabsSlot ?? null);
  },
}));

vi.mock("../../../chrome/bottom-ticker", () => ({
  BottomTicker: () => null,
}));

vi.mock("../../../chrome/kpi-strip", () => ({
  KPIStrip: () => null,
}));

vi.mock("../../../widgets/widget-detail-dialog", () => ({
  WidgetDetailDialog: () => null,
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  WIDGET_REGISTRY: new Map(),
}));

vi.mock("@radarboard/widget-engine/layouts", () => ({
  getGridAreaName: (id: string) => id,
  getSortedCells: (cells: Array<{ id: string }>) => cells,
  resolveColSizes: () => [1],
  resolveRowSizes: () => [1],
  sizesToGridTemplate: () => "minmax(0, 1fr)",
}));

vi.mock("@radarboard/widget-engine/widget-slot", () => ({
  WidgetSlot: ({
    cellId,
    onConfigure,
  }: {
    cellId: string;
    onConfigure?: (widgetId: string) => void;
  }) =>
    createElement(
      "div",
      {
        "data-testid": `widget-slot-${cellId}`,
        "data-has-configure": String(Boolean(onConfigure)),
      },
      cellId
    ),
}));

describe("DashboardStandalone", () => {
  beforeEach(() => {
    projectTabsMock.mockClear();
    topBarMock.mockClear();
  });

  it("passes a configure handler to widget slots so the config icon can render", () => {
    useCredentialsMock.mockReturnValue({ connectedKeys: [] });
    useDashboardMock.mockReturnValue({
      activeLayout: { cells: [{ id: "slot1" }] },
      activePageSlug: "overview",
      activeProjectSlug: null,
      appearance: {},
      currencies: ["USD"],
      currency: "USD",
      orderedProjects: [],
      pages: [{ slug: "overview", name: "Overview" }],
      projects: [],
      updateWidgetConfig: vi.fn(),
      widgetConfigs: {},
      setActivePage: vi.fn(),
      setActiveProject: vi.fn(),
      setCurrency: vi.fn(),
      setTimeRange: vi.fn(),
      timeRange: "today",
    });

    render(createElement(DashboardStandalone, { showDock: false, showTicker: false }));

    expect(screen.getByTestId("widget-slot-slot1").getAttribute("data-has-configure")).toBe("true");
  });

  it("renders project tabs inside the top bar when both surfaces are enabled", () => {
    useCredentialsMock.mockReturnValue({ connectedKeys: [] });
    useDashboardMock.mockReturnValue({
      activeLayout: { cells: [] },
      activePageSlug: "overview",
      activeProjectSlug: null,
      appearance: {},
      currencies: ["USD"],
      currency: "USD",
      orderedProjects: [],
      pages: [{ slug: "overview", name: "Overview" }],
      projects: [],
      updateWidgetConfig: vi.fn(),
      widgetConfigs: {},
      setActivePage: vi.fn(),
      setActiveProject: vi.fn(),
      setCurrency: vi.fn(),
      setTimeRange: vi.fn(),
      timeRange: "today",
    });

    render(createElement(DashboardStandalone, { showDock: false, showTicker: false }));

    expect(
      screen.getByTestId("top-bar").querySelector('[data-testid="project-tabs"]')
    ).toBeTruthy();
    expect(projectTabsMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "header" }));
  });

  it("keeps the dedicated project row only when the top bar is hidden", () => {
    useCredentialsMock.mockReturnValue({ connectedKeys: [] });
    useDashboardMock.mockReturnValue({
      activeLayout: { cells: [] },
      activePageSlug: "overview",
      activeProjectSlug: null,
      appearance: {},
      currencies: ["USD"],
      currency: "USD",
      orderedProjects: [],
      pages: [{ slug: "overview", name: "Overview" }],
      projects: [],
      updateWidgetConfig: vi.fn(),
      widgetConfigs: {},
      setActivePage: vi.fn(),
      setActiveProject: vi.fn(),
      setCurrency: vi.fn(),
      setTimeRange: vi.fn(),
      timeRange: "today",
    });

    render(
      createElement(DashboardStandalone, {
        showDock: false,
        showTicker: false,
        showTopBar: false,
      })
    );

    expect(screen.queryByTestId("top-bar")).toBeNull();
    expect(screen.getByTestId("project-tabs")).toBeTruthy();
    expect(projectTabsMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ variant: "header" })
    );
  });
});
