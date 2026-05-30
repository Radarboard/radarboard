// @vitest-environment jsdom

import { DashboardProvider } from "@radarboard/hooks/use-dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { getLegacyExpandedSizeStorageKey } from "../widget-modal";
import { ExpandedPortal } from "./";

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

function Harness() {
  const [widgetLayoutConfig, setWidgetLayoutConfig] = useState<WidgetLayoutConfig>({
    configs: {},
    modalPrefs: {},
  });
  const [open, setOpen] = useState(true);
  const sourceRef = useRef<HTMLDivElement | null>(null);

  if (!sourceRef.current) {
    const source = document.createElement("div");
    source.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    sourceRef.current = source;
  }

  return createElement(
    DashboardProvider,
    {
      projects: [],
      widgetLayoutConfig,
      onWidgetLayoutConfigChange: setWidgetLayoutConfig,
    },
    createElement(
      "div",
      null,
      open
        ? createElement(
            ExpandedPortal,
            {
              title: "Shipping",
              widgetId: "shipping",
              sourceRef,
              onClose: () => setOpen(false),
              defaultSize: "lg",
            },
            createElement("div", null, "Expanded Body")
          )
        : null,
      createElement(
        "button",
        {
          type: "button",
          onClick: () => setOpen(true),
        },
        "Reopen expanded"
      )
    )
  );
}

function DefaultSizeHarness() {
  const sourceRef = useRef<HTMLDivElement | null>(null);

  if (!sourceRef.current) {
    const source = document.createElement("div");
    source.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    sourceRef.current = source;
  }

  return createElement(
    DashboardProvider,
    {
      projects: [],
      widgetLayoutConfig: {
        configs: {},
        modalPrefs: {},
      },
    },
    createElement(
      ExpandedPortal,
      {
        title: "Shipping",
        widgetId: "shipping",
        sourceRef,
        onClose: () => undefined,
      },
      createElement("div", null, "Expanded Body")
    )
  );
}

describe("ExpandedPortal", () => {
  it("opens at medium size by default when no explicit expanded size or persisted preference exists", async () => {
    installMatchMedia(false);

    render(createElement(DefaultSizeHarness));

    expect(
      (await screen.findByRole("button", { name: "Medium" })).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("migrates legacy localStorage size and reopens with the persisted dashboard-backed size", async () => {
    installMatchMedia(false);
    localStorage.setItem(getLegacyExpandedSizeStorageKey("shipping"), "sm");

    render(createElement(Harness));

    expect(document.body.style.overflow).toBe("hidden");

    expect(
      (await screen.findByRole("button", { name: "Small" })).getAttribute("aria-pressed")
    ).toBe("true");
    expect(localStorage.getItem(getLegacyExpandedSizeStorageKey("shipping"))).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(screen.getByRole("button", { name: "Large" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Expanded Body")).toBeNull();
    });
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Reopen expanded" }));

    expect(
      (await screen.findByRole("button", { name: "Large" })).getAttribute("aria-pressed")
    ).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
  });
});
