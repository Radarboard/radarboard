// @vitest-environment jsdom
import type { DashboardPageConfig } from "@radarboard/types/database";
import { PageTabs } from "@radarboard/widget-engine/page-tabs";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const PAGES: DashboardPageConfig[] = [
  {
    name: "Overview",
    slug: "overview",
    layoutId: "basic-3x3",
    widgetLayouts: {},
  },
  {
    name: "Revenue",
    slug: "revenue",
    layoutId: "basic-3x3",
    widgetLayouts: {},
  },
];

describe("PageTabs", () => {
  it("does not render the add page action without a handler", () => {
    render(
      createElement(PageTabs, {
        pages: PAGES,
        activeSlug: "overview",
        onSelect: vi.fn(),
      })
    );

    expect(screen.queryByRole("button", { name: "Add page" })).toBeNull();
  });

  it("renders the add page action after the last tab when a handler is provided", () => {
    const onAddPage = vi.fn();

    render(
      createElement(PageTabs, {
        pages: PAGES,
        activeSlug: "overview",
        onSelect: vi.fn(),
        onAddPage,
      })
    );

    const addButton = screen.getByRole("button", { name: "Add page" });
    expect(addButton.previousElementSibling?.textContent).toContain("Revenue");

    fireEvent.click(addButton);

    expect(onAddPage).toHaveBeenCalledOnce();
  });
});
