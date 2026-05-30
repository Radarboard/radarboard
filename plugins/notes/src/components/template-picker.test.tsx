// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TemplatePicker } from "./template-picker";

describe("TemplatePicker", () => {
  it("supports blank notes, template selection, and manage action", () => {
    const onSelect = vi.fn();
    const onBlankNote = vi.fn();
    const onManage = vi.fn();

    render(
      createElement(TemplatePicker, {
        userTemplates: [
          {
            id: "tpl-custom",
            name: "Custom",
            description: "Custom desc",
            content: "Today is {date}",
            tags: ["custom"],
            builtIn: false,
            order: 10,
          },
        ],
        onSelect,
        onBlankNote,
        onManage,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Choose template/i }));
    fireEvent.click(screen.getByRole("button", { name: /Blank Note/i }));
    expect(onBlankNote).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Choose template/i }));
    fireEvent.click(screen.getByRole("button", { name: /Custom/i }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Custom",
        tags: ["custom"],
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Choose template/i }));
    fireEvent.click(screen.getByRole("button", { name: /Manage Templates/i }));
    expect(onManage).toHaveBeenCalled();
  });
});
