// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { WidgetSandbox } from "../index";

vi.mock("@/lib/widgets-init", () => ({
  initializeWidgetDescriptors: vi.fn(),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  WIDGET_REGISTRY: new Map([
    [
      "test-widget",
      {
        id: "test-widget",
        name: "Test Widget",
        description: "Test widget",
        defaultConfig: {
          dataSources: [{ id: "example" }],
          sections: [],
        },
      },
    ],
  ]),
}));

vi.mock("@radarboard/widget-engine/templates", () => ({
  registerTemplateDataSource: vi.fn(),
  synchronizeTemplateConfig: (config: unknown) => config,
  TemplateWidget: () => createElement("div", { "data-testid": "template-widget" }, "Template"),
}));

vi.mock("@radarboard/widget-sdk/testing", () => ({
  createEmptyWidgetData: () => ({ example: {} }),
  createMockWidgetData: () => ({ example: {} }),
}));

describe("WidgetSandbox", () => {
  it("renders every preview state inside the same constrained grid and fixed-size frame", () => {
    render(createElement(WidgetSandbox));

    const states = ["happy", "empty", "loading", "error"] as const;
    const grid = screen.getByTestId("widget-state-grid-test-widget");

    expect(grid.getAttribute("style")).toContain(
      "grid-template-columns: repeat(4, minmax(0, 1fr))"
    );

    for (const state of states) {
      const card = screen.getByTestId(`widget-preview-card-${state}`);
      expect(card.getAttribute("style")).toContain("height: 280px");
      expect(card.getAttribute("style")).toContain("min-height: 280px");
      expect(card.className).toContain("min-w-0");
      expect(card.className).toContain("overflow-hidden");
    }
  });
});
