// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkeletonShimmer } from "./";

describe("SkeletonShimmer", () => {
  it("reveals content without using document view transitions", () => {
    const startViewTransition = vi.fn(() => {
      throw new DOMException(
        "Transition was aborted because of invalid state",
        "InvalidStateError"
      );
    });

    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransition,
      configurable: true,
    });

    const { container, rerender } = render(
      <SkeletonShimmer loading={true}>
        <div>Revenue</div>
      </SkeletonShimmer>
    );

    expect((container.firstChild as HTMLElement).className).toContain("skeleton-shimmer");

    rerender(
      <SkeletonShimmer loading={false}>
        <div>Revenue</div>
      </SkeletonShimmer>
    );

    expect(screen.getByText("Revenue")).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).not.toContain("skeleton-shimmer");
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});
