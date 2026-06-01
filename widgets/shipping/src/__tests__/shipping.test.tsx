// @vitest-environment jsdom
import type { ShippingItem } from "@radarboard/types/shipping";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShippingLog } from "../components/shipping-log";

const FIXTURE: ShippingItem[] = [
  {
    id: "ship_1",
    title: "Ship template detail selection",
    projectName: "Goshuin Atlas",
    projectColor: "#ff4f6d",
    source: "linear",
    url: "https://linear.app/issue/SHIP-1",
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    timeAgo: "1h ago",
  },
];

describe("ShippingLog", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("opens the shipping detail dialog from the shared row", async () => {
    const onSelectedIdChange = vi.fn();
    const view = render(
      createElement(ShippingLog, {
        items: FIXTURE,
        selectedId: null,
        onSelectedIdChange,
      })
    );

    const row = screen.getByRole("button", { name: /Ship template detail selection/i });
    row.click();

    expect(onSelectedIdChange).toHaveBeenCalledWith("ship_1");

    view.rerender(
      createElement(ShippingLog, {
        items: FIXTURE,
        selectedId: "ship_1",
        onSelectedIdChange,
      })
    );

    expect(screen.getByText("goshuin-atlas")).toBeTruthy();
    expect(screen.getAllByText("1h ago").length).toBeGreaterThan(0);
    expect(screen.getByText("Release Activity Detail")).toBeTruthy();
    expect(screen.getAllByText("Ship template detail selection").length).toBeGreaterThan(1);
  });
});
