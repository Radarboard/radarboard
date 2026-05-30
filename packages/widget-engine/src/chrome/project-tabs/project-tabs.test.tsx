// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { ProjectTabs } from "@radarboard/widget-engine/project-tabs";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const PROJECTS: Project[] = [
  {
    id: "goshuin-atlas",
    name: "Goshuin Atlas",
    slug: "goshuin-atlas",
    color: "#E63946",
    description: "",
    platforms: [],
  },
];

describe("ProjectTabs", () => {
  it("does not mark the All Projects tab as pending when no route transition is active", () => {
    const { container } = render(
      createElement(ProjectTabs, {
        projects: PROJECTS,
        activeSlug: "goshuin-atlas",
        pendingSlug: null,
        isPending: false,
        onSelect: vi.fn(),
      })
    );

    expect(screen.getByRole("button", { name: "All Projects" }).getAttribute("aria-busy")).not.toBe(
      "true"
    );
    expect(
      screen.getByRole("button", { name: "Goshuin Atlas" }).getAttribute("aria-busy")
    ).not.toBe("true");
    expect(screen.getByRole("button", { name: "All Projects" }).className).toContain(
      "cursor-pointer"
    );
    expect(screen.getByRole("button", { name: "Goshuin Atlas" }).className).toContain(
      "cursor-pointer"
    );
    expect(container.querySelector('button[aria-busy="true"]')).toBeNull();
    expect(screen.getByTestId("project-tab-indicator-goshuin-atlas")).toBeTruthy();
    expect(
      (screen.getByTestId("project-tab-indicator-goshuin-atlas") as HTMLElement).style
        .backgroundColor
    ).toBe("rgb(255, 255, 255)");
  });

  it("marks only the destination tab as pending during a route transition", () => {
    render(
      createElement(ProjectTabs, {
        projects: PROJECTS,
        activeSlug: null,
        pendingSlug: "goshuin-atlas",
        isPending: true,
        onSelect: vi.fn(),
      })
    );

    expect(
      screen.getAllByRole("button", { name: "All Projects" }).at(-1)?.getAttribute("aria-busy")
    ).not.toBe("true");
    expect(
      screen.getAllByRole("button", { name: "Goshuin Atlas" }).at(-1)?.getAttribute("aria-busy")
    ).toBe("true");
  });

  it("keeps the project indicator slot present when a project tab is active", () => {
    render(
      createElement(ProjectTabs, {
        projects: PROJECTS,
        activeSlug: "goshuin-atlas",
        pendingSlug: null,
        isPending: false,
        onSelect: vi.fn(),
      })
    );

    expect(screen.getAllByTestId("project-tab-indicator-goshuin-atlas").at(-1)).toBeTruthy();
    expect(
      (screen.getAllByTestId("project-tab-indicator-goshuin-atlas").at(-1) as HTMLElement).style
        .backgroundColor
    ).toBe("rgb(255, 255, 255)");
  });

  it("uses the header variant as a compact horizontal scroller", () => {
    const { container } = render(
      createElement(ProjectTabs, {
        projects: PROJECTS,
        activeSlug: null,
        pendingSlug: null,
        isPending: false,
        variant: "header",
        onSelect: vi.fn(),
      })
    );

    expect(container.firstElementChild?.className).toContain("min-w-0");
    expect(container.firstElementChild?.className).toContain("overflow-x-auto");
    expect(container.firstElementChild?.className).toContain("scrollbar-thin");
    expect(screen.getByText("Goshuin Atlas").className).toContain("max-w-28");
  });
});
