// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { SummaryQuadShell } from "./";

describe("SummaryQuadShell", () => {
  it("renders four slots inside the shared 2x2 shell", () => {
    const { container } = render(
      createElement(SummaryQuadShell, {
        slots: [
          createElement("div", { key: "a" }, "A"),
          createElement("div", { key: "b" }, "B"),
          createElement("div", { key: "c" }, "C"),
          createElement("div", { key: "d" }, "D"),
        ] as const,
      })
    );

    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();

    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("grid-cols-2");
    expect(shell.childElementCount).toBe(4);
  });
});
