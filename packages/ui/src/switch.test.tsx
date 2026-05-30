// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders default classes and checked state semantics", () => {
    render(<Switch aria-label="Notifications" checked />);

    const toggle = screen.getByRole("switch", { name: "Notifications" });

    expect(toggle.getAttribute("data-state")).toBe("checked");
    expect(toggle.className).toContain("h-4");
    expect(toggle.className).toContain("w-7");
    expect(toggle.className).toContain("data-[state=checked]:bg-accent");
  });

  it("supports the success + small variants", () => {
    render(<Switch aria-label="Healthy" variant="success" size="sm" />);

    const toggle = screen.getByRole("switch", { name: "Healthy" });

    expect(toggle.className).toContain("h-3");
    expect(toggle.className).toContain("w-5");
    expect(toggle.className).toContain("data-[state=checked]:bg-success");
  });
});
