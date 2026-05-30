// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderScaffoldStory } from "./story-scaffold";

function HealthyComponent({ children }: { children?: ReactNode }) {
  return <div data-testid="healthy">{children}</div>;
}

function ThrowingComponent(): ReactElement {
  throw new Error("Missing required fixture");
}

describe("renderScaffoldStory", () => {
  it("renders the scaffold header and component output", () => {
    render(
      renderScaffoldStory({
        componentName: "HealthyComponent",
        sourcePath: "src/components/healthy.tsx",
        Component: HealthyComponent,
        args: {},
      })
    );

    expect(screen.getByText("Component Inventory")).toBeTruthy();
    expect(screen.getAllByText("HealthyComponent").length).toBe(2);
    expect(screen.getByText("src/components/healthy.tsx")).toBeTruthy();
    expect(screen.getByTestId("healthy").textContent).toBe("HealthyComponent");
  });

  it("shows the scaffold fallback when the rendered component throws", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      renderScaffoldStory({
        componentName: "ThrowingComponent",
        sourcePath: "src/components/throwing.tsx",
        Component: ThrowingComponent,
        args: {},
      })
    );

    expect(screen.getByText("Scaffold Needs Fixture")).toBeTruthy();
    expect(screen.getAllByText("ThrowingComponent").length).toBe(2);
    expect(screen.getAllByText("src/components/throwing.tsx").length).toBe(2);
    expect(screen.getByText("Missing required fixture")).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
