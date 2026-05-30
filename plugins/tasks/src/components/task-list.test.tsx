// @vitest-environment jsdom

import { TooltipProvider } from "@radarboard/ui/tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TaskList } from "./task-list";

describe("TaskList", () => {
  it("shows the empty states", () => {
    const { rerender } = render(
      createElement(TaskList, {
        tasks: [],
        onSelect: vi.fn(),
        onStatusCycle: vi.fn(),
        onDelete: vi.fn(),
        onStartPomodoro: vi.fn(),
        trashMode: false,
      })
    );

    expect(screen.getByText("No tasks yet. Press `n` to create one.")).toBeTruthy();

    rerender(
      createElement(TaskList, {
        tasks: [],
        onSelect: vi.fn(),
        onStatusCycle: vi.fn(),
        onDelete: vi.fn(),
        onStartPomodoro: vi.fn(),
        trashMode: true,
      })
    );

    expect(screen.getByText("Trash is empty.")).toBeTruthy();
  });

  it("renders rows and hover actions for active and trash modes", () => {
    const onSelect = vi.fn();
    const onStatusCycle = vi.fn();
    const onDelete = vi.fn();
    const onRestore = vi.fn();
    const onPermanentDelete = vi.fn();
    const onStartPomodoro = vi.fn();

    const { rerender } = render(
      createElement(
        TooltipProvider,
        null,
        createElement(TaskList, {
          tasks: [
            {
              id: "task-1",
              title: "Ship feature",
              description: "important",
              status: "todo",
              priority: "high",
              dueDate: "2026-03-28",
              projectId: "atlas",
              subtasks: [{ id: "sub-1", title: "x", done: true }],
              recurrence: { pattern: "daily" },
              deletedAt: null,
              createdAt: "2026-03-20T00:00:00.000Z",
              updatedAt: "2026-03-20T00:00:00.000Z",
            },
          ],
          onSelect,
          onStatusCycle,
          onDelete,
          onStartPomodoro,
          activePomodoroTaskId: "task-1",
          trashMode: false,
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /Cycle status/i }));
    fireEvent.click(screen.getByRole("button", { name: /Start Pomodoro|Pomodoro active/i }));
    fireEvent.click(screen.getByRole("button", { name: /Move to trash/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ship feature/i }));

    expect(onStatusCycle).toHaveBeenCalled();
    expect(onStartPomodoro).toHaveBeenCalledWith("task-1");
    expect(onDelete).toHaveBeenCalledWith("task-1");
    expect(onSelect).toHaveBeenCalled();

    rerender(
      createElement(
        TooltipProvider,
        null,
        createElement(TaskList, {
          tasks: [
            {
              id: "task-2",
              title: "Trashed",
              description: "",
              status: "done",
              priority: "low",
              subtasks: [],
              recurrence: null,
              deletedAt: "2026-03-20T00:00:00.000Z",
              createdAt: "2026-03-20T00:00:00.000Z",
              updatedAt: "2026-03-20T00:00:00.000Z",
            },
          ],
          onSelect,
          onStatusCycle,
          onDelete,
          onRestore,
          onPermanentDelete,
          onStartPomodoro,
          trashMode: true,
        })
      )
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Restore/i })[1]!);
    fireEvent.click(screen.getAllByRole("button", { name: /Delete Forever/i })[1]!);

    expect(onRestore).toHaveBeenCalledWith("task-2");
    expect(onPermanentDelete).toHaveBeenCalledWith("task-2");
  });
});
