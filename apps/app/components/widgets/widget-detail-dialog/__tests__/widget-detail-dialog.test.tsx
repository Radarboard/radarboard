// @vitest-environment jsdom

import { DashboardProvider } from "@radarboard/hooks/use-dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import type { WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { WidgetDetailDialog } from "../";

vi.mock("../../widget-config-panel", () => ({
  WidgetConfigPanel: () => createElement("div", null, "Widget Config Panel"),
}));

const TEST_DESCRIPTOR = {
  id: "shipping",
  name: "Shipping",
  description: "Shipping widget",
  requiredIntegrations: [],
  defaultSlot: "slot1",
  component: () => null,
  defaultConfig: {},
} satisfies WidgetDescriptor<Record<string, unknown>>;

function Harness() {
  const [widgetLayoutConfig, setWidgetLayoutConfig] = useState<WidgetLayoutConfig>({
    configs: {},
    modalPrefs: {},
  });
  const [open, setOpen] = useState(true);

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
      createElement(WidgetDetailDialog, {
        descriptor: TEST_DESCRIPTOR,
        open,
        onOpenChange: setOpen,
        config: {},
        onConfigChange: vi.fn(),
        onConfigReplace: vi.fn(),
        connectedKeys: [],
      }),
      createElement(
        "button",
        {
          type: "button",
          onClick: () => setOpen(true),
        },
        "Reopen dialog"
      )
    )
  );
}

describe("WidgetDetailDialog", () => {
  it("reopens with the previously selected size for the same widget config modal", async () => {
    render(createElement(Harness));

    const largeButton = (await screen.findAllByRole("button", { name: "Large" }))[0];
    fireEvent.click(largeButton);
    expect(largeButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen dialog" }));

    expect(
      (await screen.findAllByRole("button", { name: "Large" }))[0]?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByText("Widget Config Panel")).toBeTruthy();
  }, 30_000);
});
