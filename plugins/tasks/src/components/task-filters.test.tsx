// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TaskFilters } from "./task-filters";

describe("TaskFilters", () => {
  it("shows status and priority filters in list mode", () => {
    render(
      createElement(TaskFilters, {
        statusFilter: "all",
        priorityFilter: "medium",
        viewMode: "active",
        displayMode: "list",
        onStatusChange: vi.fn(),
        onPriorityChange: vi.fn(),
        onViewModeChange: vi.fn(),
      })
    );

    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
  });

  it("hides the status filter in kanban mode", () => {
    render(
      createElement(TaskFilters, {
        statusFilter: "all",
        priorityFilter: "medium",
        viewMode: "active",
        displayMode: "kanban",
        onStatusChange: vi.fn(),
        onPriorityChange: vi.fn(),
        onViewModeChange: vi.fn(),
      })
    );

    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.getByText("Priority")).toBeTruthy();
  });
});
