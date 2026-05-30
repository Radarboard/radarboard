// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendIndicator } from "./index";

describe("TrendIndicator", () => {
  it("renders up arrow with positive percentage", () => {
    render(<TrendIndicator direction="up" changePct={15.5} />);
    expect(screen.getByTitle("Trending up: +15.5%")).toBeDefined();
  });

  it("renders down arrow with negative percentage", () => {
    render(<TrendIndicator direction="down" changePct={-8.2} />);
    expect(screen.getByTitle("Trending down: -8.2%")).toBeDefined();
  });

  it("renders flat arrow for flat direction", () => {
    render(<TrendIndicator direction="flat" changePct={0.5} />);
    expect(screen.getByTitle("Flat: +0.5%")).toBeDefined();
  });

  it("hides value when showValue is false", () => {
    const { container } = render(
      <TrendIndicator direction="up" changePct={10} showValue={false} />
    );
    expect(container.textContent).not.toContain("+10%");
  });

  it("shows value by default", () => {
    const { container } = render(<TrendIndicator direction="up" changePct={10} />);
    expect(container.textContent).toContain("+10%");
  });
});
