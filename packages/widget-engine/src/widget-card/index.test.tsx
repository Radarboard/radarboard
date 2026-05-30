// @vitest-environment jsdom

import { DashboardProvider } from "@radarboard/hooks/use-dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import type { WidgetChromeStatus, WidgetExpandAction } from "@radarboard/widget-sdk/widget-types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WidgetCard } from "./";

vi.mock("../hooks/use-export-widget-image", () => ({
  useExportWidgetImage: () => ({
    exportAsPng: vi.fn(),
    isExporting: false,
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function installMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
}

function WidgetCardHarness({
  expandAction,
  chromeStatus,
  onRefetch,
  isEditMode = false,
  onExpandedWidgetIdChange,
}: {
  expandAction?: WidgetExpandAction;
  chromeStatus?: WidgetChromeStatus;
  onRefetch?: (() => Promise<void>) | null;
  isEditMode?: boolean;
  onExpandedWidgetIdChange?: (id: string | null) => void;
}) {
  const [widgetLayoutConfig, setWidgetLayoutConfig] = useState<WidgetLayoutConfig>({
    configs: {},
    modalPrefs: {},
  });
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);

  return createElement(
    DashboardProvider,
    {
      projects: [],
      widgetLayoutConfig,
      onWidgetLayoutConfigChange: setWidgetLayoutConfig,
      expandedWidgetId,
      onExpandedWidgetIdChange: (id: string | null) => {
        onExpandedWidgetIdChange?.(id);
        setExpandedWidgetId(id);
      },
    },
    createElement(
      "div",
      { style: { height: "320px", width: "420px" } },
      createElement(
        WidgetCard,
        {
          title: "Shipping",
          widgetId: "shipping",
          expandedContent:
            expandAction?.type === "open-plugin"
              ? undefined
              : createElement("div", null, "Expanded Body"),
          expandAction,
          chromeStatus,
          onRefetch,
          isEditMode,
        },
        createElement("div", null, "Compact Body")
      )
    )
  );
}

describe("WidgetCard", () => {
  beforeEach(() => {
    installMatchMedia(false);
  });

  function getActionButton(name: string) {
    return screen.getAllByRole("button", { name }).at(-1);
  }

  it("opens the expanded portal from the expand button", async () => {
    render(createElement(WidgetCardHarness));

    fireEvent.click(getActionButton("Expand Shipping") as HTMLElement);

    expect(await screen.findByRole("dialog", { name: "Shipping" })).toBeTruthy();
    expect(screen.getByText("Expanded Body")).toBeTruthy();
  });

  it("opens the expanded portal from a card double-click", async () => {
    render(createElement(WidgetCardHarness));

    fireEvent.doubleClick(screen.getByRole("region", { name: "Shipping" }));

    expect(await screen.findByRole("dialog", { name: "Shipping" })).toBeTruthy();
  });

  it("keeps open-plugin widgets on plugin navigation instead of opening the expanded portal", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      createElement(WidgetCardHarness, {
        expandAction: { type: "open-plugin", pluginId: "tasks" },
      })
    );

    fireEvent.click(getActionButton("Open Shipping") as HTMLElement);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "radarboard:navigate",
      })
    );
    expect(screen.queryByRole("dialog", { name: "Shipping" })).toBeNull();
  });

  it("closes the expanded portal when reduced motion is enabled", async () => {
    installMatchMedia(true);
    const onExpandedWidgetIdChange = vi.fn();

    render(createElement(WidgetCardHarness, { onExpandedWidgetIdChange }));

    fireEvent.click(getActionButton("Expand Shipping") as HTMLElement);
    expect(await screen.findByRole("dialog", { name: "Shipping" })).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Close expanded view" }).at(-1) as HTMLElement
    );

    await waitFor(() => {
      expect(onExpandedWidgetIdChange).toHaveBeenCalledWith(null);
    });
  });

  it("hides utility actions and disables expansion affordances when disconnected", () => {
    const refetch = vi.fn(async () => {});

    render(
      createElement(WidgetCardHarness, {
        chromeStatus: "disconnected",
        onRefetch: refetch,
      })
    );

    expect(screen.queryByRole("button", { name: "Refresh Shipping" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export Shipping as image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand Shipping" })).toBeNull();

    fireEvent.doubleClick(screen.getByRole("region", { name: "Shipping" }));

    expect(screen.queryByRole("dialog", { name: "Shipping" })).toBeNull();
    expect(refetch).not.toHaveBeenCalled();
  });
});
