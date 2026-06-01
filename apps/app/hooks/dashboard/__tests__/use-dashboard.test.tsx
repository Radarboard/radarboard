// @vitest-environment jsdom
import { DashboardProvider, useDashboard } from "@radarboard/hooks/use-dashboard";
import {
  ALL_PROJECTS_SLUG,
  AUTO_LOCALE,
  DEFAULT_DASHBOARD_TIME_RANGE,
} from "@radarboard/types/dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal provider wrapper — no external state or callbacks. */
function staticWrapper({ children }: { children: ReactNode }) {
  return createElement(DashboardProvider, { projects: [] }, children);
}

/**
 * Provider wrapper that owns widgetLayoutConfig state internally, mirroring
 * how the real app uses DashboardProvider as a controlled component.
 */
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

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

describe("useDashboard — edit mode", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("starts with edit mode disabled", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });
    expect(result.current.isEditMode).toBe(false);
  });

  it("enables edit mode when toggleEditMode is called", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    act(() => result.current.toggleEditMode());

    expect(result.current.isEditMode).toBe(true);
  });

  it("toggles back to false on second call", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    act(() => result.current.toggleEditMode());
    act(() => result.current.toggleEditMode());

    expect(result.current.isEditMode).toBe(false);
  });

  it("does not read from localStorage — ignores any legacy lock value", () => {
    localStorage.setItem("radarboard:layout-locked", "true");

    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    expect(result.current.isEditMode).toBe(false);
  });

  it("does not write to localStorage when toggled", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    act(() => result.current.toggleEditMode());

    expect(localStorage.length).toBe(0);
  });

  it("is transient — a fresh provider instance always starts with edit mode off", () => {
    const { result: first } = renderHook(() => useDashboard(), { wrapper: staticWrapper });
    act(() => first.current.toggleEditMode());
    expect(first.current.isEditMode).toBe(true);

    // A new render tree (simulates page reload) has its own state
    const { result: second } = renderHook(() => useDashboard(), { wrapper: staticWrapper });
    expect(second.current.isEditMode).toBe(false);
  });
});

describe("useDashboard — active project", () => {
  it("uses the externally controlled active project slug when provided", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        { projects: [], activeProjectSlug: "goshuin-atlas" },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.activeProjectSlug).toBe("goshuin-atlas");
  });

  it("delegates project changes to the external controller when provided", () => {
    const onActiveProjectChange = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          activeProjectSlug: null,
          onActiveProjectChange,
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    act(() => result.current.setActiveProject("goshuin-atlas"));

    expect(onActiveProjectChange).toHaveBeenCalledOnce();
    expect(onActiveProjectChange).toHaveBeenCalledWith("goshuin-atlas");
    expect(result.current.activeProjectSlug).toBeNull();
  });

  it("exposes externally controlled project transition state", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          activeProjectSlug: "front-end-checklist",
          pendingProjectSlug: "goshuin-atlas",
          isProjectSwitching: true,
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.pendingProjectSlug).toBe("goshuin-atlas");
    expect(result.current.isProjectSwitching).toBe(true);
  });

  it("keeps the active data slug route-bound while allowing a switch back to All Projects", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          activeProjectSlug: "goshuin-atlas",
          pendingProjectSlug: null,
          isProjectSwitching: true,
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.activeProjectSlug).toBe("goshuin-atlas");
    expect(result.current.pendingProjectSlug).toBeNull();
    expect(result.current.isProjectSwitching).toBe(true);
  });
});

describe("useDashboard — active page", () => {
  it("falls back to the owner's first page when no page slug is provided", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          activeProjectSlug: null,
          widgetLayoutConfig: {
            configs: {},
            projectLayouts: {
              [ALL_PROJECTS_SLUG]: {
                pages: [
                  {
                    name: "Executive",
                    slug: "executive",
                    layoutId: "basic-3x3",
                    widgetLayouts: {
                      "basic-3x3": { slot1: "analytics" },
                    },
                  },
                ],
              },
            },
          },
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.activePageSlug).toBe("executive");
    expect(result.current.activePage.name).toBe("Executive");
  });

  it("delegates page changes to the external controller when provided", () => {
    const onActivePageChange = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          activePageSlug: "executive",
          onActivePageChange,
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    act(() => result.current.setActivePage("operations"));

    expect(onActivePageChange).toHaveBeenCalledOnce();
    expect(onActivePageChange).toHaveBeenCalledWith("operations");
  });
});

describe("useDashboard — time range", () => {
  it("defaults uncontrolled dashboards to the canonical time range", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    expect(result.current.timeRange).toBe(DEFAULT_DASHBOARD_TIME_RANGE);
  });

  it("uses the externally controlled time range when provided", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(DashboardProvider, { projects: [], timeRange: "today" }, children);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.timeRange).toBe("today");
  });

  it("delegates time range changes to the external controller when provided", () => {
    const onTimeRangeChange = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          timeRange: "today",
          onTimeRangeChange,
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    act(() => result.current.setTimeRange("today"));

    expect(onTimeRangeChange).toHaveBeenCalledOnce();
    expect(onTimeRangeChange).toHaveBeenCalledWith("today");
    expect(result.current.timeRange).toBe("today");
  });
});

describe("useDashboard — timezone", () => {
  it("defaults timezone preference to auto", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    expect(result.current.timezonePreference).toBe("auto");
    expect(result.current.localePreference).toBe(AUTO_LOCALE);
    expect(result.current.effectiveTimezone).toBeTruthy();
    expect(result.current.effectiveLocale).toBeTruthy();
  });

  it("uses persisted timezone preference from widget layout config", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          widgetLayoutConfig: {
            configs: {},
            preferences: { timezone: "America/Toronto" },
          },
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.timezonePreference).toBe("America/Toronto");
    expect(result.current.effectiveTimezone).toBe("America/Toronto");
  });

  it("uses persisted locale preference from widget layout config", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        DashboardProvider,
        {
          projects: [],
          widgetLayoutConfig: {
            configs: {},
            preferences: { locale: "fr-CA" },
          },
        },
        children
      );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.localePreference).toBe("fr-CA");
    expect(result.current.effectiveLocale).toBe("fr-CA");
  });

  it("updates persisted preferences through updatePreferences", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: ControlledProvider });

    act(() =>
      result.current.updatePreferences({
        timezone: "America/Los_Angeles",
        locale: "de-DE",
      })
    );

    expect(result.current.timezonePreference).toBe("America/Los_Angeles");
    expect(result.current.effectiveTimezone).toBe("America/Los_Angeles");
    expect(result.current.localePreference).toBe("de-DE");
    expect(result.current.effectiveLocale).toBe("de-DE");
  });

  it("defaults polling preferences to an empty object", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: staticWrapper });

    expect(result.current.pollingPreferences).toEqual({});
  });

  it("merges polling preference updates without dropping timezone", () => {
    function PollingPreferencesWrapper({ children }: { children: ReactNode }) {
      const [config, setConfig] = useState<WidgetLayoutConfig>({
        configs: {},
        preferences: {
          timezone: "America/Toronto",
          polling: { analytics: 300000 },
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

    const { result } = renderHook(() => useDashboard(), { wrapper: PollingPreferencesWrapper });

    act(() => result.current.updatePreferences({ polling: { analytics: 60000 } }));

    expect(result.current.timezonePreference).toBe("America/Toronto");
    expect(result.current.pollingPreferences).toEqual({ analytics: 60000 });
  });
});
