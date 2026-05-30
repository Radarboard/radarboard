// @vitest-environment jsdom
import { DashboardProvider, useDashboard } from "@radarboard/hooks/use-dashboard";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { BASIC_3X3, getSortedCells } from "@radarboard/widget-engine/layouts";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

function ControlledProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<WidgetLayoutConfig | undefined>(undefined);
  return createElement(
    DashboardProvider,
    {
      projects: [],
      widgetLayoutConfig: config,
      onWidgetLayoutConfigChange: setConfig,
    },
    children
  );
}

describe("useDashboard — updateWidgetLayout", () => {
  it("stores the supplied layout on the All Projects pseudo-project", () => {
    const onUpdate = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        { projects: [], onWidgetLayoutConfigChange: onUpdate },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    const newLayout = {
      slot1: "shipping",
      slot2: "revenue",
      slot3: null,
      slot4: null,
      slot5: null,
      slot6: null,
      slot7: null,
      slot8: null,
      slot9: null,
    };

    act(() => result.current.updateWidgetLayout(newLayout));

    const [firstCell, secondCell] = getSortedCells(BASIC_3X3.cells);
    expect(onUpdate).toHaveBeenCalledOnce();
    const calledConfig = onUpdate.mock.calls[0][0] as WidgetLayoutConfig;
    expect(
      calledConfig.projectLayouts?.[ALL_PROJECTS_SLUG]?.pages?.[0]?.widgetLayouts?.["basic-3x3"]?.[
        firstCell?.id ?? ""
      ]
    ).toBeUndefined();
    expect(
      calledConfig.projectLayouts?.[ALL_PROJECTS_SLUG]?.pages?.[0]?.widgetLayouts?.["basic-3x3"]?.[
        secondCell?.id ?? ""
      ]
    ).toBeUndefined();
  });

  it("reflects the updated layout when the provider is re-rendered with new config", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: ControlledProvider });

    const newLayout = {
      slot1: "roadmap",
      slot2: null,
      slot3: null,
      slot4: null,
      slot5: null,
      slot6: null,
      slot7: null,
      slot8: null,
      slot9: null,
    };

    act(() => result.current.updateWidgetLayout(newLayout));

    const firstCellId = getSortedCells(result.current.activeLayout.cells)[0]?.id;
    expect(firstCellId ? result.current.widgetLayout[firstCellId] : null).toBe("roadmap");
  });
});

describe("useDashboard — updateLayouts", () => {
  it("preserves a widget assignment when two cells are merged", () => {
    function LayoutMigrationWrapper({ children }: { children: ReactNode }) {
      const [config, setConfig] = useState<WidgetLayoutConfig>({
        configs: {},
        layouts: [
          {
            id: "hero",
            name: "Hero",
            cells: [
              { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
              { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
            ],
            colSizes: [50, 50],
            rowSizes: [100],
          },
        ],
        projectLayouts: {
          [ALL_PROJECTS_SLUG]: {
            pages: [
              {
                name: "Overview",
                slug: "overview",
                layoutId: "hero",
                widgetLayouts: {
                  hero: {
                    "cell-1": null,
                    "cell-2": "shipping",
                  },
                },
              },
            ],
          },
        },
      });

      return createElement(
        DashboardProvider,
        {
          projects: [],
          widgetLayoutConfig: config,
          onWidgetLayoutConfigChange: setConfig,
        },
        children
      );
    }

    const { result } = renderHook(() => useDashboard(), { wrapper: LayoutMigrationWrapper });

    act(() =>
      result.current.updateLayouts([
        {
          id: "hero",
          name: "Hero",
          cells: [{ id: "merged-cell", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 2 }],
          colSizes: [100],
          rowSizes: [100],
        },
      ])
    );

    expect(result.current.widgetLayout["merged-cell"]).toBe("shipping");
  });
});

describe("useDashboard — widget modal prefs", () => {
  it("defaults modal prefs to an empty map and falls back to the supplied default size", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(DashboardProvider, { projects: [] }, children);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.modalPrefs).toEqual({});
    expect(result.current.getWidgetModalSize("shipping", "shipping.item", "sm")).toBe("sm");
  });

  it("persists modal size updates in controlled widget layout state", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: ControlledProvider });

    act(() => result.current.updateWidgetModalSize("shipping", "shipping.item", "lg"));

    expect(result.current.modalPrefs).toEqual({
      shipping: {
        "shipping.item": "lg",
      },
    });
    expect(result.current.getWidgetModalSize("shipping", "shipping.item", "sm")).toBe("lg");
  });

  it("keeps existing modal prefs when widget config changes", () => {
    function PrefsWrapper({ children }: { children: ReactNode }) {
      const [config, setConfig] = useState<WidgetLayoutConfig>({
        configs: {},
        modalPrefs: {
          shipping: {
            "shipping.item": "md",
          },
        },
      });

      return createElement(
        DashboardProvider,
        {
          projects: [],
          widgetLayoutConfig: config,
          onWidgetLayoutConfigChange: setConfig,
        },
        children
      );
    }

    const { result } = renderHook(() => useDashboard(), { wrapper: PrefsWrapper });

    act(() => result.current.updateWidgetConfig("shipping", { compactLimit: 8 }));

    expect(result.current.modalPrefs).toEqual({
      shipping: {
        "shipping.item": "md",
      },
    });
    expect(result.current.widgetConfigs.shipping).toEqual({ compactLimit: 8 });
  });
});

describe("useDashboard — replaceWidgetLayoutConfig", () => {
  it("passes the entire config to onWidgetLayoutConfigChange in one call", () => {
    const onUpdate = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        { projects: [], onWidgetLayoutConfigChange: onUpdate },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    const fullConfig: WidgetLayoutConfig = {
      configs: { myWidget: { foo: "bar" } },
      modalPrefs: {},
      layouts: [],
      projectLayouts: {
        [ALL_PROJECTS_SLUG]: {
          pages: [
            {
              name: "Overview",
              slug: "overview",
              layoutId: "custom",
              widgetLayouts: { custom: { cell1: "widget-a" } },
            },
          ],
        },
      },
      preferences: { demoMode: true, onboardingCompleted: true },
      appearance: { fontScale: "lg" },
    };

    act(() => result.current.replaceWidgetLayoutConfig(fullConfig));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(fullConfig);
  });
});
