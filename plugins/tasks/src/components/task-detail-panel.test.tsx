// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TaskDetailPanel } from "./task-detail-panel";

vi.mock("./subtask-list", () => ({
  SubtaskList: ({
    onToggle,
    onAdd,
    onRemove,
  }: {
    onToggle: (id: string) => void;
    onAdd: (title: string) => void;
    onRemove: (id: string) => void;
  }) =>
    createElement("div", null, [
      createElement(
        "button",
        { key: "toggle", type: "button", onClick: () => onToggle("sub-1") },
        "Toggle subtask"
      ),
      createElement(
        "button",
        { key: "add", type: "button", onClick: () => onAdd("New subtask") },
        "Add subtask"
      ),
      createElement(
        "button",
        { key: "remove", type: "button", onClick: () => onRemove("sub-1") },
        "Remove subtask"
      ),
    ]),
}));

vi.mock("../task-operations", async () => {
  const actual = await vi.importActual<typeof import("../task-operations")>("../task-operations");
  return {
    ...actual,
    generateId: vi.fn(() => "generated-subtask"),
  };
});

describe("TaskDetailPanel", () => {
  it("updates title, metadata, recurrence, subtasks, and actions", () => {
    const onUpdate = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      createElement(TaskDetailPanel, {
        task: {
          id: "task-1",
          title: "Ship feature",
          description: "important",
          status: "todo",
          priority: "medium",
          dueDate: "2026-03-28",
          projectId: "atlas",
          folderId: undefined,
          subtasks: [{ id: "sub-1", title: "Check", done: false }],
          recurrence: { pattern: "custom", intervalDays: 3 },
          deletedAt: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-21T00:00:00.000Z",
        },
        projects: ["atlas"],
        folders: [
          {
            id: "folder-1",
            name: "Atlas",
            type: "project",
            projectSlug: "atlas",
            archived: false,
            order: 1,
            createdAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        onUpdate,
        onArchive,
        onDelete,
        onClose,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Ship feature/i }));
    fireEvent.change(screen.getByDisplayValue("Ship feature"), {
      target: { value: "Ship feature 2" },
    });
    fireEvent.keyDown(screen.getByDisplayValue("Ship feature 2"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /Done/i }));
    fireEvent.click(screen.getByRole("button", { name: /Urgent/i }));
    fireEvent.change(screen.getByDisplayValue("2026-03-28"), {
      target: { value: "2026-04-01" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "folder-1" } });
    fireEvent.change(screen.getByPlaceholderText("Add a description..."), {
      target: { value: "updated desc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Toggle subtask/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add subtask/i }));
    fireEvent.click(screen.getByRole("button", { name: /Remove subtask/i }));
    fireEvent.change(screen.getAllByRole("combobox")[1]!, { target: { value: "none" } });
    fireEvent.click(screen.getByRole("button", { name: /^Archive$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Move to trash/i }));
    fireEvent.click(screen.getByRole("button", { name: /^$/ })); // close icon button

    expect(onUpdate).toHaveBeenCalledWith("task-1", { title: "Ship feature 2" });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { status: "done" });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { priority: "urgent" });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { dueDate: "2026-04-01" });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { folderId: "folder-1", projectId: "atlas" });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { description: "updated desc" });
    expect(onUpdate).toHaveBeenCalledWith("task-1", {
      subtasks: [{ id: "sub-1", title: "Check", done: true }],
    });
    expect(onUpdate).toHaveBeenCalledWith("task-1", {
      subtasks: [
        { id: "sub-1", title: "Check", done: false },
        { id: "generated-subtask", title: "New subtask", done: false },
      ],
    });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { subtasks: [] });
    expect(onUpdate).toHaveBeenCalledWith("task-1", { recurrence: null });
    expect(onArchive).toHaveBeenCalledWith("task-1");
    expect(onDelete).toHaveBeenCalledWith("task-1");
    expect(onClose).toHaveBeenCalled();
  });
});
