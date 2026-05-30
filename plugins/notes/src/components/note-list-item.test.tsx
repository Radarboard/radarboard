// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { NoteListItem } from "./note-list-item";

describe("NoteListItem", () => {
  it("renders note metadata and pin action", () => {
    const onClick = vi.fn();
    const onPin = vi.fn();

    render(
      createElement(NoteListItem, {
        note: {
          id: "note-1",
          title: "Alpha Note",
          content: "## Heading\nhello world",
          contentFormat: "markdown",
          tags: ["docs", "alpha"],
          status: "active",
          pinned: false,
          wordCount: 2,
          trashedAt: null,
          archivedAt: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-21T00:00:00.000Z",
        },
        selected: true,
        searchQuery: "alpha",
        onClick,
        onPin,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Pin/i }));
    fireEvent.click(screen.getByRole("button", { name: /Alpha.*Heading hello world/i }));

    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText(/Heading hello world/i)).toBeTruthy();
    expect(onPin).toHaveBeenCalledWith("note-1");
    expect(onClick).toHaveBeenCalled();
  });

  it("shows archived state without pin hover actions", () => {
    render(
      createElement(NoteListItem, {
        note: {
          id: "note-2",
          title: "Archived Note",
          content: "body",
          contentFormat: "markdown",
          tags: [],
          status: "archived",
          pinned: false,
          wordCount: 1,
          trashedAt: null,
          archivedAt: "2026-03-21T00:00:00.000Z",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-21T00:00:00.000Z",
        },
        selected: false,
        searchQuery: "",
        onClick: vi.fn(),
        onPin: vi.fn(),
      })
    );

    expect(screen.queryByRole("button", { name: /Pin/i })).toBeNull();
  });
});
